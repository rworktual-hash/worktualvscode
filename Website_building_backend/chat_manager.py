# chat_manager.py

import os
import re
import json
import logging
from typing import Dict, Any, List
from google import genai
from datetime import datetime

logger = logging.getLogger("ai-site-generator.chat_manager")

class ChatManager:
    """
    Manages the state and logic for the AI-driven chat state machine, 
    determining if the user wants to start a new generation, an edit, 
    or continue a casual conversation.
    """
    def __init__(self, api_key: str, chat_model: str = "gemini-2.5-flash"):
        self.client = genai.Client(api_key=api_key) if api_key else None
        self.CHAT_MODEL = chat_model
        
        # State variables for conversation memory
        self.chat_context: Dict[str, Any] = {'history': []} 
        self.current_project_info: Dict[str, str] = {}
        
        self.MAX_HISTORY_MESSAGES = 10
        # Determine the root directory where the website is built
        self.GENERATED_DIR = os.path.abspath("generated_website") 

    def safe_json_parse(self, text: str) -> Dict[str, Any] | None:
        """
        ULTRA-ROBUST function to aggressively clean and parse JSON from LLM output.
        It handles markdown fences, conversational text, and attempts multiple levels of cleaning.
        """
        logger.info("Attempting robust JSON parsing for chat response...")
        
        # 1. Tries to load the whole text
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass # Continue to cleaning

        # 2. Aggressive Cleaning (Removes markdown fences and common LLM commentary)
        cleaned = re.sub(r'```json|```javascript|```python|```|Here is the JSON output\s*:|```bash', '', text, flags=re.IGNORECASE)
        cleaned = cleaned.strip()

        # 3. Find the most likely JSON content by looking for the outermost braces
        try:
            start_index = cleaned.find('{')
            end_index = cleaned.rfind('}')
            
            if start_index != -1 and end_index != -1 and end_index > start_index:
                json_content = cleaned[start_index : end_index + 1]
                
                # Sub-step 3a: Remove common non-JSON errors (like trailing commas or comments)
                json_content = re.sub(r',\s*\}', '}', json_content) # Remove trailing comma before '}'
                json_content = re.sub(r',\s*\]', ']', json_content) # Remove trailing comma before ']'
                json_content = re.sub(r'//.*', '', json_content) # Remove single-line comments // 
                
                # Sub-step 3b: Attempt to parse the isolated and cleaned content
                result = json.loads(json_content)
                logger.info("Successfully parsed JSON after aggressive cleaning.")
                return result
            
        except Exception as e:
            logger.error(f"Final aggressive JSON parsing failed. Error: {e}")
            pass

        logger.error("JSON extraction failed completely.")
        return None

    def set_project_info(self, name: str, description: str, is_ecommerce: bool):
        """Updates the project information after a successful generation (for memory/context)."""
        self.current_project_info = {
            "name": name,
            "description": description,
            "is_ecommerce": is_ecommerce
        }
        
    def reset_context(self):
        """Clears the chat history, typically after starting a generation or cancellation."""
        self.chat_context = {'history': []}
        
    def get_current_project_info(self) -> Dict[str, str]:
        """Returns the stored project memory."""
        return self.current_project_info

    def is_website_building_intent(self, user_message: str) -> bool:
        """Detect if user wants to build a website based on keywords."""
        website_keywords = [
            'build website', 'create website', 'generate website', 'make website',
            'build a website', 'create a website', 'generate a website', 'make a website',
            'build me a website', 'create me a website', 'generate me a website',
            'e-commerce website', 'ecommerce website', 'portfolio website', 'business website',
            'landing page', 'web app', 'web application', 'react website', 'react site',
            'online store', 'shop website', 'company website', 'personal website',
            'blog website', 'dashboard website', 'admin panel', 'website for',
            'website to', 'site for', 'site to', 'webpage for', 'webpage to'
        ]
        
        user_lower = user_message.lower()
        return any(keyword in user_lower for keyword in website_keywords)

    def handle_message(self, user_message: str) -> Dict[str, Any]:
        """
        Processes a user message through the AI-driven state machine.
        Returns the action required by the FastAPI endpoint (e.g., "start_generation").
        """
        if not self.client:
             return {"success": True, "reply": "Hey! My AI chat is limited right now (API key missing). To start, please provide a prompt or select a sample (1-4)!", "action": "none"}

        user_message = user_message.strip()
        has_existing_site = os.path.exists(self.GENERATED_DIR) and bool(self.current_project_info.get('name'))
        history_to_pass = self.chat_context.get('history', [])
        
        # Check for direct website building intent via keywords
        if self.is_website_building_intent(user_message) and not has_existing_site:
            # Force request_confirmation action for website building
            return {
                "success": True,
                "reply": f"I understand you want to build a website: '{user_message}'. This sounds great! Should I proceed with building this website for you?",
                "action": "request_confirmation",
                "prompt": user_message,
                "is_edit": False
            }
        
        # --- 2. Construct AI System Prompt (The State Machine) ---
        system_instruction = f"""
            You are WORTUAL ADVANCE CODING, a professional and friendly AI website builder assistant.
            
            CRITICAL: You must follow the EXACT chat flow pattern below. Return ONLY valid JSON.
            
            **REQUIRED CHAT FLOW PATTERN:**
            1. GREETING: When user says hi/hello → Show sample websites
            2. IDEA_REQUEST: When user wants to develop → Ask for project details  
            3. CONFIRMATION: When user provides idea → Confirm before building
            4. GENERATION: When user confirms → Start building
            
            **RESPONSE_SCHEMA** (MANDATORY):
            {{
                "action": "ACTION_TYPE",
                "reply": "USER_FRIENDLY_MESSAGE",
                "prompt": "GENERATION_PROMPT",
                "is_edit": false
            }}
            
            **ACTION_TYPES AND RESPONSES:**

            1. **GREETING STATE** (hi, hello, hey, start, good morning, etc.)
               action: "request_idea"
               reply: "Hello! I'm here to help you build amazing websites. Here are some popular options to get started:\n\n1: Modern Blog Site - Clean, responsive design with article management\n2: E-commerce platform for handmade goods - Complete shopping experience\n3: SaaS landing page for an AI tool - Professional marketing site\n4: Personal portfolio for a graphic designer - Showcase your work beautifully\n\nChoose one (1-4) or describe your own website idea!"
               prompt: ""
               is_edit: false

            2. **IDEA_REQUEST STATE** (when user asks "I want to develop", "can you build", "I need a website", etc.)
               action: "request_idea" 
               reply: "I'd love to help you build a website! Please tell me more about your project idea. What type of website do you want to create? Be as specific as possible about the purpose, features, and any particular design preferences you have."
               prompt: ""
               is_edit: false

            3. **CONFIRMATION STATE** (user provides a clear website idea or selects sample 1-4)
               action: "request_confirmation"
               reply: "I understand you want to create [summarize their idea clearly]. This sounds great! Should I proceed with building this website for you?"
               prompt: "[full detailed prompt based on their request]"
               is_edit: false

            4. **GENERATION STATE** (user confirms with yes, ok, start, proceed, go ahead, etc.)
               action: "start_generation"
               reply: "Perfect! I'm starting to build your website now. This will take a few moments..."
               prompt: "[the confirmed website request]"
               is_edit: false

            5. **CANCELLATION STATE** (user says no, cancel, stop, not now, etc.)
               action: "cancel_action"
               reply: "No problem! What would you like to do instead? Feel free to share a different website idea or ask about our features."
               prompt: ""
               is_edit: false

            6. **EDIT REQUESTS** (change, modify, update existing site, when site exists)
               action: "request_confirmation"
               reply: "I understand you want to make changes to your current website [site name]. Should I proceed with these updates?"
               prompt: "[detailed edit instructions]"
               is_edit: true

            7. **STATUS INQUIRIES** (what did you build, current site, etc.)
               action: "casual_reply"
               reply: "[provide info about current project if exists, otherwise encourage new project]"
               prompt: ""
               is_edit: false

            **CURRENT CONTEXT:**
            - Has Existing Site: {'Yes' if has_existing_site else 'No'}
            - Current Project: {self.current_project_info.get('name', 'None')}
            - Chat History Length: {len(history_to_pass)}
            
            **IMPORTANT RULES:**
            - Follow the flow pattern strictly: Greeting → Idea Request → Confirmation → Generation
            - If user provides idea after greeting, go directly to Confirmation
            - If edit intent detected and site exists, use is_edit: true
            - Always be friendly and encouraging
            - Return ONLY JSON, no markdown or extra text
        """
        
        # --- 3. Call Gemini API ---
        try:
            chat_session = self.client.chats.create(
                model=self.CHAT_MODEL, 
                config={"system_instruction": system_instruction},
                history=history_to_pass
            )
            
            response = chat_session.send_message(user_message)
            ai_response_text = response.text
            
            # --- 4. Parse and Execute Action ---
            ai_response_json = self.safe_json_parse(ai_response_text)
            
            if not ai_response_json or 'action' not in ai_response_json:
                logger.error(f"Invalid JSON/Action from AI: {ai_response_text}")
                # Maintain history but return an error reply
                self.chat_context['history'] = history_to_pass 
                return {"success": True, "reply": "Oops! I seem to have lost my place. Could you please state your website idea or instruction clearly?", "action": "none"}
            
            # Update history before processing the action
            self.chat_context['history'] = chat_session.get_history()[-self.MAX_HISTORY_MESSAGES:]
                 
            action = ai_response_json.get("action")
            
            # --- 5. Handle Actions ---
            response_payload = {
                "success": True, 
                "reply": ai_response_json.get("reply", "Understood. One moment."),
                "action": action, 
            }
            
            if action in ["start_generation", "request_confirmation"]:
                
                is_edit_flag = ai_response_json.get("is_edit", False)
                prompt = ai_response_json.get("prompt", "")
                
                # CRITICAL CHECK: If AI incorrectly sets is_edit=True but no site exists, force new gen.
                if is_edit_flag and not has_existing_site:
                     is_edit_flag = False
                     logger.warning("AI attempted to set is_edit=True but no site exists. Forcing is_edit=False.")
                     
                response_payload['prompt'] = prompt
                response_payload['is_edit'] = is_edit_flag
            
            if action == "cancel_action" or action == "start_generation":
                # Clear chat history when starting a task or canceling to prepare for the next focused conversation
                self.reset_context() 

            return response_payload

        except Exception as e:
            logger.exception("Chat manager processing failed")
            return {"success": False, "reply": f"An unexpected error occurred: {str(e)}", "action": "none"}
