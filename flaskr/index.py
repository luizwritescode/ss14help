
import json
import os
from dotenv import load_dotenv
from flask import Flask, render_template
import whitenoise

load_dotenv()

data_path = os.path.join(os.path.dirname(__file__), 'data', 'data.json')
all_data = {}
with open(data_path) as f:
    all_data = json.load(f)

app = Flask(__name__)
app.wsgi_app = whitenoise.WhiteNoise(app.wsgi_app, root=os.path.join(app.root_path, 'static'), prefix='static/')


@app.route('/')
def index():
    return render_template('home/index.html', reaction_categories=all_data['reactions'], cooking_categories=all_data['cooking'], current_commit=all_data['current_commit'], last_updated=all_data['last_updated'])

@app.route('/static/favicon.ico')
def favicon():
    return app.send_static_file('static/favicon.ico')

if __name__ == '__main__' and os.environ.get('FLASK_ENV') == 'development':
    app.run(debug=True)