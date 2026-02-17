from sales.leads import LeadManager
from sales.customers import CustomerManager
from marketing.campaigns import CampaignManager

def sales_menu(lead_manager, customer_manager):
    while True:
        print("\n--- Sales Module ---")
        print("1. Add a new lead")
        print("2. View all leads")
        print("3. Update lead status")
        print("4. Add a new customer")
        print("5. View all customers")
        print("6. Return to main menu")
        choice = input("Enter choice: ")

        if choice == '1':
            name = input("Enter lead name: ")
            email = input("Enter lead email: ")
            phone = input("Enter lead phone: ")
            lead_manager.add_lead(name, email, phone)
        elif choice == '2':
            lead_manager.view_leads()
        elif choice == '3':
            lead_id = int(input("Enter lead ID: "))
            status = input("Enter new status (e.g., contacted, qualified, lost): ")
            lead_manager.update_lead_status(lead_id, status)
        elif choice == '4':
            name = input("Enter customer name: ")
            email = input("Enter customer email: ")
            company = input("Enter customer company: ")
            customer_manager.add_customer(name, email, company)
        elif choice == '5':
            customer_manager.view_customers()
        elif choice == '6':
            break
        else:
            print("Invalid choice.")

def marketing_menu(campaign_manager):
    while True:
        print("\n--- Marketing Module ---")
        print("1. Create a new campaign")
        print("2. View all campaigns")
        print("3. Return to main menu")
        choice = input("Enter choice: ")

        if choice == '1':
            name = input("Enter campaign name: ")
            start_date = input("Enter start date (YYYY-MM-DD): ")
            budget = float(input("Enter budget: "))
            campaign_manager.create_campaign(name, start_date, budget)
        elif choice == '2':
            campaign_manager.view_campaigns()
        elif choice == '3':
            break
        else:
            print("Invalid choice.")

def main():
    lead_manager = LeadManager()
    customer_manager = CustomerManager()
    campaign_manager = CampaignManager()

    while True:
        print("\n--- Main Menu ---")
        print("1. Sales Module")
        print("2. Marketing Module")
        print("3. Exit")
        choice = input("Enter your choice: ")

        if choice == '1':
            sales_menu(lead_manager, customer_manager)
        elif choice == '2':
            marketing_menu(campaign_manager)
        elif choice == '3':
            print("Exiting CRM.")
            break
        else:
            print("Invalid choice, please try again.")

if __name__ == "__main__":
    main()
