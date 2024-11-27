import os
import time
import logging
from dotenv import load_dotenv
from flask import Flask
from .db import close_db, init_db_command, get_db
from .AutoUpdate import AutoUpdate 
from .YamlParser import YamlParser 

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] - %(asctime)s  - %(message)s',datefmt='%Y-%m-%d %H:%M:%S',)

au = AutoUpdate(logger=logging.getLogger())
yp = YamlParser()


# create the application

def create_app(test_config=None):
	
	# check if source contains any files
	source_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'source')
	if not os.path.exists(source_dir) or len(os.listdir(source_dir)) == 0:
		logging.error("Source directory does not exist!")
		au.clone_and_checkout_repository()
	

	# create and configure the app
	app = Flask(__name__, instance_relative_config=True)
	app.config.from_mapping(
		SECRET_KEY=os.environ.get('SECRET_KEY'),
		DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'),
	)

	if test_config is None:
		# load the instance config, if it exists, when not testing
		app.config.from_pyfile('config.py', silent=True)
	else:
		# load the test config if passed in
		app.config.from_mapping(test_config)


	# ensure the instance folder exists
	try:
		os.makedirs(app.instance_path)
	except OSError:
		pass

	app.teardown_appcontext(close_db)
	app.cli.add_command(init_db_command)

	with app.app_context():
		db = get_db()
		last_updated = db.execute('SELECT last_update FROM config').fetchone()['last_update']

		current_time = time.time()
		if last_updated is not None:
			# if (current_time - float(last_updated)) > 86400 or True:
				# logging.info("24 hours have passed, checking for updates...")
				try: 
					au.check_for_updates()
					db.execute(f'UPDATE config SET last_update = {current_time}')
					db.commit()
				except Exception as e:
					logging.error(f"Error checking for updates: {e}")



	
	# get parent directory
	project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
	
	current_commit = au.get_latest_commit_name()

	# if the last update was more than 24 hours ago, check for updates

	# parse all data

	all_data = yp.parse_all_data()

	all_data['current_commit'] = current_commit

	# parse unix timestamp
	parsed_time = time.gmtime(float(last_updated))
	all_data['last_updated'] = f"{parsed_time.tm_year}-{parsed_time.tm_mon:02d}-{parsed_time.tm_mday:02d} {parsed_time.tm_hour:02d}:{parsed_time.tm_min:02d}:{parsed_time.tm_sec:02d} GMT"

	@app.route('/favicon.ico')
	def favicon():
		return app.send_static_file('favicon.ico')
	
	# Register the blueprint
	from .home import construct_blueprint

	home_bp = construct_blueprint(all_data)
	app.register_blueprint(home_bp)
	
	# return the app
	return app

