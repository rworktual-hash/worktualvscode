import os
from dotenv import load_dotenv

# Load environment variables from the .env file in the current directory
load_dotenv()

# Get environment variables
app_name = os.getenv("APP_NAME")
api_key = os.getenv("API_KEY")

# Use the variables
print(f"Application Name: {app_name}")

if api_key:
    print(f"API Key Loaded: {api_key[:4]}...****")
else:
    print("API_KEY not found in .env file.")
