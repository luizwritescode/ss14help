import os
import time
import subprocess
from git import Repo


class AutoUpdate:
    def __init__(self, repo_url ="https://github.com/space-wizards/space-station-14.git", branch = "master", repo_subfolder = "Resources/Prototypes/Recipes", logger = None):
        self.repo_url = repo_url
        self.repo_subfolder = repo_subfolder
        self.branch = branch
        self.project_dir = os.path.dirname(os.path.abspath(__file__))
        self.repo_path_local = os.path.join(self.project_dir, "source")
        self.logger = logger

        self.last_updated = None
        
        # Clone the repository if it doesn't exist
        if not os.path.exists(self.repo_path_local):
            self.clone_and_checkout_repository()

    def clone_and_checkout_repository(self):
        self.logger.info("AutoUpdate: Cloning the repository...")
        try:
            # Clone the repository
            if not os.path.exists(self.repo_path_local):
                os.mkdir(self.repo_path_local)

            subprocess.run(["git", "init", self.repo_path_local],shell=False)
            # print the current working directory
            os.chdir(self.repo_path_local)
            subprocess.run(["git", "remote", "add", "origin", self.repo_url], shell=False)

            subprocess.run(["git", "config", "core.sparseCheckout", "true"], shell=False)
            open(".git/info/sparse-checkout", "w").write(self.repo_subfolder)

            # Fetch the latest changes
            subprocess.run(["git", "pull", "--depth=3", "origin", self.branch], shell=False)

            os.chdir(self.project_dir)

        except Exception as e:
            self.logger.error(f"AutoUpdate: Error cloning the repository: {e}")

    def check_for_updates(self):

        try:
            # Open the repository
            repo = Repo(self.repo_path_local)

            # Fetch the latest changes
            repo.remotes.origin.fetch()

            # Get the number of commits ahead of the local repository
            num_commits = len(list(repo.iter_commits(f"origin/{self.branch}..{self.branch}")))

            # If there are new commits, pull the latest changes

            if num_commits > 0:
                self.logger.info(f"AutoUpdate: There are {num_commits} new commit(s) available. Pulling the latest changes...")
                self.pull_and_update()
            else:
                self.logger.info("AutoUpdate: No new commits available.")

            
        except Exception as e:
            self.logger.error(f"AutoUpdate: Error checking for updates: {e}")

    def pull_and_update(self):
        try:
            subprocess.run(["git", "pull", "origin", self.branch])

            self.last_updated = time.time()
            self.logger.info("AutoUdpate: Successfully pulled the latest changes.")
        except Exception as e:
            self.logger.error(f"AutoUpdate: Error pulling the latest changes: {e}")


    def get_latest_commit_name(self):
        try:
            repo = Repo(self.repo_path_local)
            return repo.head.commit.name_rev
        except Exception as e:
            self.logger.error(f"AutoUpdate: Error getting the latest commit name: {e}")
            return None
        
    # get the last time the repo was checked for updates
    def get_last_updated(self):
        try:
            repo = Repo(self.repo_path_local)
            return repo.head.commit.committed_datetime
        except Exception as e:
            self.logger.error(f"AutoUpdate: Error getting the last updated time: {e}")
            return None		
        
    def set_last_updated(self, last_updated):
        self.last_updated = last_updated
