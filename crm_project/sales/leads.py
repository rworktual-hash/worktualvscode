from database import db

class LeadManager:
    def __init__(self):
        self.leads = db['leads']
        self.next_id = 1

    def add_lead(self, name, email, phone):
        lead_id = self.next_id
        self.leads[lead_id] = {
            "name": name,
            "email": email,
            "phone": phone,
            "status": "new"
        }
        print(f"Lead '{name}' added with ID {lead_id}.")
        self.next_id += 1

    def view_leads(self):
        if not self.leads:
            print("No leads found.")
            return
        print("\n--- All Leads ---")
        for lid, details in self.leads.items():
            print(f"ID: {lid} | Name: {details['name']} | Email: {details['email']} | Status: {details['status']}")
        print("-----------------")

    def update_lead_status(self, lead_id, new_status):
        if lead_id in self.leads:
            self.leads[lead_id]['status'] = new_status
            print(f"Lead {lead_id} status updated to '{new_status}'.")
        else:
            print("Lead ID not found.")
