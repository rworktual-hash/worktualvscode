def insertion_sort(arr):
    """Sorts a list in ascending order using the insertion sort algorithm."""
    # Traverse through 1 to len(arr)
    for i in range(1, len(arr)):
        key = arr[i]
        # Move elements of arr[0..i-1], that are greater than key,
        # to one position ahead of their current position
        j = i - 1
        while j >= 0 and key < arr[j]:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key

# Example usage:
if __name__ == "__main__":
    data = [12, 11, 13, 5, 6, 7]
    print("Original array:")
    print(data)
    
    insertion_sort(data)
    
    print("Sorted array:")
    print(data)

