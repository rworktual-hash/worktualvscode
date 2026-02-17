import requests
import json

def get_weather(api_key, city):
    base_url = "http://api.openweathermap.org/data/2.5/weather?"
    complete_url = f"{base_url}appid={api_key}&q={city}&units=metric"
    
    try:
        response = requests.get(complete_url)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("cod") != 404:
            main_data = data.get("main", {})
            weather_data = data.get("weather", [{}])[0]
            
            temperature = main_data.get("temp")
            humidity = main_data.get("humidity")
            weather_description = weather_data.get("description")
            
            if all([temperature, humidity, weather_description]):
                print(f"City: {city}")
                print(f"Temperature: {temperature}°C")
                print(f"Humidity: {humidity}%")
                print(f"Weather: {weather_description.capitalize()}")
            else:
                print("Could not retrieve complete weather data.")
        else:
            print("City Not Found.")
            
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    API_KEY = "YOUR_API_KEY" # IMPORTANT: Replace with your OpenWeatherMap API key
    
    if API_KEY == "YOUR_API_KEY":
        print("Error: Please replace 'YOUR_API_KEY' with your actual OpenWeatherMap API key in main.py.")
        print("You can get a free key from https://openweathermap.org/appid")
    else:
        city_name = input("Enter city name: ")
        if city_name:
            get_weather(API_KEY, city_name)
        else:
            print("City name cannot be empty.")
