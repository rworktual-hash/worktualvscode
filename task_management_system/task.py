import datetime

class Task:
    def __init__(self, task_id, description, due_date=None, status="pending"):
        self.task_id = task_id
        self.description = description
        self.due_date = due_date
        self.status = status

    def __str__(self):
        due_date_str = self.due_date.strftime('%Y-%m-%d') if self.due_date else "No due date"
        return f"ID: {self.task_id} | Description: {self.description} | Due Date: {due_date_str} | Status: {self.status}"

    def update_status(self, new_status):
        if new_status in ["pending", "completed", "in-progress"]:
            self.status = new_status
            print(f"Task {self.task_id} status updated to '{self.status}'.")
        else:
            print("Invalid status. Choose from 'pending', 'completed', 'in-progress'.")