import os
import yaml
import ReactionEffects


project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class YamlParser:
    def __init__(self):
        pass

    def get_loader(self):
        loader = yaml.SafeLoader
        loader.add_constructor('!type:ExplosionReactionEffect', self.ExplosionReactionEffect_constructor)
        loader.add_constructor('!type:AreaReactionEffect', self.AreaReactionEffect_constructor)
        loader.add_constructor('!type:EmpReactionEffect', self.EmpReactionEffect_constructor)
        loader.add_constructor('!type:FlashReactionEffect', self.FlashReactionEffect_constructor)
        loader.add_constructor('!type:CreateEntityReactionEffect', self.CreateEntityReactionEffect_constructor)
        loader.add_constructor('!type:CreateGas', self.CreateGas_constructor)
        loader.add_constructor('!type:PopupMessage', self.PopupMessage_constructor)

        return loader
    
    def ExplosionReactionEffect_constructor(self, loader, node):
        values = loader.construct_mapping(node)
        return ReactionEffects.ExplosionReactionEffect(**values)
    
    def AreaReactionEffect_constructor(self, loader, node):
        values = loader.construct_mapping(node)
        return ReactionEffects.AreaReactionEffect(**values)
    
    def EmpReactionEffect_constructor(self, loader, node):
        values = loader.construct_mapping(node)
        return ReactionEffects.EmpReactionEffect(**values)
    
    def FlashReactionEffect_constructor(self, loader, node):
        return ReactionEffects.FlashReactionEffect()
    
    def CreateEntityReactionEffect_constructor(self, loader, node):
        values = loader.construct_mapping(node)
        return ReactionEffects.CreateEntityReactionEffect(**values)
    
    def CreateGas_constructor(self, loader, node):
        values = loader.construct_mapping(node)
        return ReactionEffects.CreateGas(**values)

    def PopupMessage_constructor(self, loader, node):
        values = loader.construct_mapping(node)
        return ReactionEffects.PopupMessage(**values)
    

    
    def parse(self, yaml_file):
        with open(yaml_file, 'r') as stream:
            try:
                return yaml.load(stream, Loader=self.get_loader())
            except yaml.YAMLError as exc:
                print(exc)

    def parse2(self, yaml_file):
        with open(yaml_file, 'r') as stream:
            try:
                return yaml.safe_load(stream)
            except yaml.YAMLError as exc:
                print(exc)


    def parse_all_data(self):		
        reactions = {}
        reactions['biological'] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'biological.yml') )
        reactions['botany'] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'botany.yml') )
        reactions['chemicals'] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'chemicals.yml') )
        reactions['cleaning'] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'cleaning.yml') )
        reactions['drinks'] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'drinks.yml') )
        reactions['food'] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'food.yml') )
        reactions['fun'] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'fun.yml') )
        reactions['gas'] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'gas.yml') )
        reactions['medicine'] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'medicine.yml') )
        reactions['pyrotechnic'] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'pyrotechnic.yml') )
        reactions['single_reagent'] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'single_reagent.yml') )
        
        cooking = {}
        cooking["meals"] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Cooking', 'meal_recipes.yml') )
        cooking["medical"] = self.parse( os.path.join(project_dir, 'autoupdate', 'source', 'Resources', 'Prototypes', 'Recipes', 'Cooking', 'medical_recipes.yml') )
        
        all_data = {}
        all_data['reactions'] = reactions
        all_data['cooking'] = cooking
        
        all_data = self.add_reactant_metadata(all_data)

        return all_data

    def serialize_data(self, data):
        # Make sure all data is JSON serializable
        reaction_categories_dict = data['reactions']
        for cat in data['reactions']:
            for i,recipe in enumerate(reaction_categories_dict[cat]):

                if 'effects' in recipe and isinstance(recipe['effects'], list) and all(isinstance(effect, ReactionEffects.ReactionEffect) for effect in recipe['effects']):
                    effects = {}
                    for effect in recipe['effects']:
                        effects[str(type(effect).__name__)] = effect.to_dict()

                    data['reactions'][cat][i]['effects'] = effects

        stringified = str(data)
        stringified = stringified.replace("\'", '"')
        # edge case for clown's (i hate this so much)
        stringified = stringified.replace("clown\"s", 'clown\'s')
        stringified = stringified.replace("True", "\"true\"")
        stringified = stringified.replace("False", "\"false\"")
        return stringified

    # go through all recipes, and if the recipe contains ingredients that are in the recipe list, flag the ingredient as non basic
    def add_reactant_metadata(self, data):
        
        # get all reactions from all reaction recipes in list
        all_reactions = []
        for subcategory in data["reactions"]:
            for recipe in data["reactions"][subcategory]:
                if recipe["id"] not in all_reactions:
                    all_reactions.append(recipe["id"])

        # go through all recipes and flag recipe id's that are not basic
        for subcategory in data["reactions"]:
            for recipe in data["reactions"][subcategory]:
                for reactant in recipe['reactants']:
                    if reactant in all_reactions:
                        recipe['reactants'][reactant]['basic'] = False
                    else:
                        recipe['reactants'][reactant]['basic'] = True
                if 'products' in recipe:
                    for product in recipe['products']:
                        recipe['products'][product] = {'basic': False, 'amount': recipe['products'][product]}
                        if product in all_reactions:
                            recipe['products'][product]['basic'] = False
                        else:
                            recipe['products'][product]['basic'] = True
        # print(recipe['reactants'])

        return data



# if __name__ == "__main__":
# 	import os 
# 	project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))		
# 	parsedyaml = YamlParser( os.path.join(project_dir, 'source', 'Resources', 'Prototypes', 'Recipes', 'Reactions', 'chemicals.yml') ).parse()

# 	print(parsedyaml[9]['effects'])
