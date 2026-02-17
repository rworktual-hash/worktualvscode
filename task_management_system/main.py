from task_manager import TaskManager

def print_menu():
    print("\n--- Task Management System ---")
    print("1. Add a new task")
    print("2. View all tasks")
    print("3. Update a task's status")
    print("4. Remove a task")
    print("5. Exit")
    print("----------------------------")

def main():
    manager = TaskManager()

    while True:
        print_menu()
        choice = input("Enter your choice (1-5): ")

        if choice == '1':
            description = input("Enter task description: ")
            due_date = input("Enter due date (YYYY-MM-DD, optional): ")
            manager.add_task(description, due_date if due_date else None)
        elif choice == '2':
            manager.view_tasks()
        elif choice == '3':
            try:
                task_id = int(input("Enter task ID to update: "))
                new_status = input("Enter new status (pending, in-progress, completed): ")
                manager.update_task_status(task_id, new_status)
            except ValueError:
                print("Invalid ID. Please enter a number.")
        elif choice == '4':
            try:
                task_id = int(input("Enter task ID to remove: "))
                manager.remove_task(task_id)
            except ValueError:
                print("Invalid ID. Please enter a number.")
        elif choice == '5':
            print("Exiting Task Management System. Goodbye!")
            break
        else:
            print("Invalid choice. Please enter a number between 1 and 5.")

if __name__ == "__main__":
    main()