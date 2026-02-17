from flask import Flask, render_template, request, redirect, url_for, flash

app = Flask(__name__)
app.secret_key = 'your_secret_key' # IMPORTANT: Change this!

@app.route('/')
def home():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')
    # This is a dummy authentication. In a real app, you'd check a database.
    if username == 'admin' and password == 'password':
        return f'<h1>Welcome, {username}!</h1><p>You have successfully logged in.</p>'
    else:
        flash('Invalid username or password')
        return redirect(url_for('home'))

if __name__ == '__main__':
    # Before running, make sure to install Flask: pip install Flask
    app.run(debug=True)