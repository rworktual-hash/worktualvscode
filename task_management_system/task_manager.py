from task import Task
import datetime

class TaskManager:
    def __init__(self):
        self.tasks = {}
        self.next_id = 1

    def add_task(self, description, due_date_str=None):
        due_date = None
        if due_date_str:
            try:
                due_date = datetime.datetime.strptime(due_date_str, '%Y-%m-%d')
            except ValueError:
                print("Invalid date format. Please use YYYY-MM-DD.")
                return

        task = Task(self.next_id, description, due_date)
        self.tasks[self.next_id] = task
        print(f"Task added with ID: {self.next_id}")
        self.next_id += 1

    def view_tasks(self):
        if not self.tasks:
            print("No tasks to show.")
            return
        for task_id, task in self.tasks.items():
            print(task)

    def update_task_status(self, task_id, new_status):
        if task_id in self.tasks:
            self.tasks[task_id].update_status(new_status)
        else:
            print(f"Task with ID {task_id} not found.")

    def remove_task(self, task_id):
        if task_id in self.tasks:
            del self.tasks[task_id]
            print(f"Task {task_id} removed.")
        else:
            print(f"Task with ID {task_id} not found.")