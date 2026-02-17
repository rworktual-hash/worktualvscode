from database import db

class CampaignManager:
    def __init__(self):
        self.campaigns = db['campaigns']
        self.next_id = 1

    def create_campaign(self, name, start_date, budget):
        campaign_id = self.next_id
        self.campaigns[campaign_id] = {
            "name": name,
            "start_date": start_date,
            "budget": budget,
            "status": "planned"
        }
        print(f"Campaign '{name}' created with ID {campaign_id}.")
        self.next_id += 1

    def view_campaigns(self):
        if not self.campaigns:
            print("No campaigns found.")
            return
        print("\n--- All Campaigns ---")
        for cid, details in self.campaigns.items():
            print(f"ID: {cid} | Name: {details['name']} | Budget: ${details['budget']} | Status: {details['status']}")
        print("---------------------")
