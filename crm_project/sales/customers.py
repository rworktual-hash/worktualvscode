from database import db

class CustomerManager:
    def __init__(self):
        self.customers = db['customers']
        self.next_id = 1

    def add_customer(self, name, email, company):
        customer_id = self.next_id
        self.customers[customer_id] = {
            "name": name,
            "email": email,
            "company": company
        }
        print(f"Customer '{name}' added with ID {customer_id}.")
        self.next_id += 1

    def view_customers(self):
        if not self.customers:
            print("No customers found.")
            return
        print("\n--- All Customers ---")
        for cid, details in self.customers.items():
            print(f"ID: {cid} | Name: {details['name']} | Company: {details['company']}")
        print("---------------------")
