
import json
import os
from dotenv import load_dotenv
from flask import Flask, render_template
import whitenoise

load_dotenv()

# create the application

# def create_app(test_config=None):

#     # create and configure the app
#     app = Flask(__name__, instance_relative_config=True)
#     app.config.from_mapping(
#         SECRET_KEY=os.environ.get('SECRET_KEY'),
#         DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'),
#     )

#     if test_config is None:
#         # load the instance config, if it exists, when not testing
#         app.config.from_pyfile('config.py', silent=True)
#     else:
#         # load the test config if passed in
#         app.config.from_mapping(test_config)


#     # ensure the instance folder exists
#     try:
#         os.makedirs(app.instance_path)
#     except OSError:
#         pass

#     app.teardown_appcontext(close_db)
#     app.cli.add_command(init_db_command)

#     @app.route('/favicon.ico')
#     def favicon():
#         return app.send_static_file('favicon.ico')
    

#     # Load the data from data.json
#     all_data = {}
#     with open('flaskr/data/data.json') as f:
#         all_data = json.load(f)

#     # Register the blueprint

#     home_bp = construct_blueprint(all_data)
#     app.register_blueprint(home_bp)
    
#     # return the app
#     return app

data_path = os.path.join(os.path.dirname(__file__), 'data', 'data.json')
all_data = {}
with open(data_path) as f:
    all_data = json.load(f)



app = Flask(__name__)
app.wsgi_app = whitenoise.WhiteNoise(app.wsgi_app, root=os.path.join(app.root_path, 'static'), prefix='static/')


@app.route('/')
def index():
    return render_template('home/index.html', reaction_categories=all_data['reactions'], cooking_categories=all_data['cooking'], current_commit=all_data['current_commit'], last_updated=all_data['last_updated'])