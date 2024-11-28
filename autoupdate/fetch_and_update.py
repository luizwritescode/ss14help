import os
import json
import time
import logging
from AutoUpdate import AutoUpdate
from YamlParser import YamlParser

# Set up logging
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] - %(asctime)s  - %(message)s',datefmt='%Y-%m-%d %H:%M:%S',)

au = AutoUpdate(logger=logging.getLogger())
yp = YamlParser()

# Check if the repository has been cloned
if not os.path.exists(au.repo_path_local):
    au.clone_and_checkout_repository()    

# Check for updates
au.check_for_updates()

# Get the latest commit name
current_commit = au.get_latest_commit_name()

all_data = yp.parse_all_data()

all_data['current_commit'] = current_commit

parsed_time = time.gmtime(au.get_last_updated().timestamp())
all_data['last_updated'] = time.strftime("%Y-%m-%d %H:%M:%S", parsed_time)

serialized_data = yp.serialize_data(all_data)
# Save all data to a json file

with open('flaskr/data/data.json', 'w', encoding='utf-8') as f:
    f.write(serialized_data)
    logging.info("Successfully saved all data to data.json")