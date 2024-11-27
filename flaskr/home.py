from flask import Blueprint, render_template, current_app
from .YamlParser import YamlParser as YP
from .game_classes.ReactionEffects import ReactionEffect
# Create a new Flask Blueprint

def construct_blueprint(data):
	bp = Blueprint('home', __name__, url_prefix='/')
	
	@bp.route('/')
	def index():

		reaction_categories_dict = data['reactions']
		for cat in data['reactions']:
			for i,recipe in enumerate(reaction_categories_dict[cat]):

				if 'effects' in recipe and isinstance(recipe['effects'], list) and all(isinstance(effect, ReactionEffect) for effect in recipe['effects']):
					effects = {}
					for effect in recipe['effects']:
						effects[str(type(effect).__name__)] = effect.to_dict()

					data['reactions'][cat][i]['effects'] = effects

		stringified_reactions = str(data['reactions']).replace("\'", '"')	
		return render_template('home/index.html', reaction_categories=data['reactions'],stringified_reactions=stringified_reactions, cooking_categories=data['cooking'], current_commit=data['current_commit'], last_updated=data['last_updated'])
	
	return bp