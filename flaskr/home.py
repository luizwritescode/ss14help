from flask import Blueprint, render_template, current_app
# Create a new Flask Blueprint

def construct_blueprint(data):
    bp = Blueprint('home', __name__, url_prefix='/')
    
    @bp.route('/')
    def index():

        return render_template('home/index.html', reaction_categories=data['reactions'], cooking_categories=data['cooking'], current_commit=data['current_commit'], last_updated=data['last_updated'])
    
    return bp