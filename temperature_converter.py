# Converts Celsius to Fahrenheit
def celsius_to_fahrenheit(celsius):
    return (celsius * 9/5) + 32

# Converts Fahrenheit to Celsius
def fahrenheit_to_celsius(fahrenheit):
    return (fahrenheit - 32) * 5/9

if __name__ == "__main__":
    # Example usage
    celsius_temp = 25
    fahrenheit_temp = celsius_to_fahrenheit(celsius_temp)
    print(f"{celsius_temp}°C is equal to {fahrenheit_temp:.2f}°F")

    fahrenheit_temp_2 = 77
    celsius_temp_2 = fahrenheit_to_celsius(fahrenheit_temp_2)
    print(f"{fahrenheit_temp_2}°F is equal to {celsius_temp_2:.2f}°C")
