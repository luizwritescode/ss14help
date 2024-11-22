const searchBar = document.getElementById("search-bar");


function clearSearchBar() {
	document.getElementById("search-bar").value = "";
	let recipes = document.getElementsByClassName("recipe");
	for (let recipe of recipes) {
		recipe.style.display = "flex";
		recipe.classList.remove("fade");
	}
	let categories = document.getElementsByClassName("list-category-header");
	for (let category of categories) {
		category.style.display = "flex";
		category.getElementsByTagName("i")[0].classList.add("toggled");
	}

	//clear all dynamically created recipes for the amount search
	let dynamicRecipes = document.getElementsByClassName("dynamic-recipe");
	for (let recipe of dynamicRecipes) {
		recipe.remove();
	}
}

function hideCategories(categories) {
	for (let category of categories) {
		category.style.display = "none";
	}
}

function reactantHasRecipe(reactant) {
	return document.getElementById(reactant);
}

function showReactants(recipe, skippedRecipes = []) {
	if (!recipe) {
		return;
	}
	let reactants = recipe.children[1].children[0].getElementsByClassName("ingredient");
	for (let rr in reactants) {
		// find the recipe with the reactant as id and show it
		let reactantRecipe = document.getElementById(reactants[rr].textContent);
		skippedRecipes.push(reactantRecipe);
		if (reactantRecipe) {
			reactantRecipe.style.display = "flex";
			// if the reactant has a recipe, show it
			showReactants(reactantRecipe);
		}
	}
}

function showReactantsWithAmounts(recipe, totalAmountOfReactants, amount) {
	if (recipe === null) {
		return;
	} else if (recipe instanceof HTMLParagraphElement) {
		recipe = document.getElementById(recipe.textContent.split(" ")[0]);
	}
	let reactants;
	try {
		reactants = recipe.children[1].children[0].children;
	}
	catch (e) {
		return;
	}
	for (let rr of reactants) {
		// find the recipe with the reactant as id and show it
		if (recipe) {
			// if the reactant has a recipe, create a dynamic recipe with the corresponding amounts
			let newRecipe = recipe.cloneNode(true);
			let newRecipeId = newRecipe.children[0];
			let newRecipeReactants = newRecipe.children[1].children[0];
			let newRecipeProducts = newRecipe.children[1].children[2];
			for (let product of newRecipeProducts.children) {
				let productSplit = product.textContent.split(" ");
				let productAmount = parseInt(productSplit[1].replace("[", "").replace("]", ""));
				let productName = productSplit[0];
				product.textContent = productName + " [" + Math.round( amount ) + "]";
			}

			let totalAmountOfReactantsNew = 0
			for (let reactant of newRecipeReactants.children) {
				let reactantSplit = reactant.textContent.split(" ");
				let reactantAmount = parseInt(reactantSplit[1].replace("[", "").replace("]", ""));
				totalAmountOfReactantsNew += reactantAmount;
			}

			for (let reactant of newRecipeReactants.children) {
				let reactantSplit = reactant.textContent.split(" ");
				let reactantAmount = parseInt(reactantSplit[1].replace("[", "").replace("]", ""));
				let reactantName = reactantSplit[0];
				let newReactantAmount = Math.round((amount * reactantAmount) / totalAmountOfReactantsNew);
				reactant.textContent = reactantName + " [" + newReactantAmount + "]";
				if(reactantHasRecipe(reactantName))
					showReactantsWithAmounts(reactant, totalAmountOfReactants, newReactantAmount);
			}

			newRecipe.classList.add("dynamic-recipe");
			newRecipeId.textContent = amount + "u " + newRecipeId.textContent;
			recipe.after(newRecipe);
			newRecipe.style.display = "flex";

			break
			
		}
	}
}



function onInputSearchBar() {

	let activeCategory = document.getElementById(getActiveCategory());
	let recipes = activeCategory.getElementsByClassName("recipe");
	let categories = document.getElementsByClassName("list-category-header");

	// first, show all recipes and categories
	for (let recipe of recipes) {
		recipe.style.display = "flex";
	}
	for (let category of categories) {
		category.style.display = "flex";
	}

	// delete all dynamically created recipes for the amount search
	let dynamicRecipes = document.getElementsByClassName("dynamic-recipe");
	for (let recipe of dynamicRecipes) {
		recipe.remove();
	}

	if (searchBar.value.length > 0) {
		for (let recipe of recipes) {
			recipe.style.display = "none";
		}

		let skipRegularSearch = false;
		// if search value in the format "{Integer}u {string}" show the recipe with the corresponding amounts
		let searchValueSplit = searchBar.value.toLowerCase().split(" ");
		if (searchValueSplit.length === 2 && searchValueSplit[0].split("u").length === 2) {

			for (let recipe of recipes) {
				let recipeid = recipe.children[0];
				let recipeName = recipeid.textContent.replace(':', '').toLowerCase();
				if (recipeName === searchValueSplit[1].toLowerCase()) {
					skipRegularSearch = true;
					// create a new recipe view with the corresponding amounts
					let newRecipe = recipe.cloneNode(true);
					let newRecipeId = searchValueSplit[0] + recipeName;
					let newRecipeReactants = newRecipe.children[1].children[0];
					let newRecipeProducts = newRecipe.children[1].children[2];
					for (let product of newRecipeProducts.children) {
						let productSplit = product.textContent.split(" ");
						let productAmount = parseInt(productSplit[1].replace("[", "").replace("]", ""));
						let productName = productSplit[0];
						product.textContent = productName + " [" + parseInt(searchValueSplit[0]) + "]";
					}

					let totalAmountOfReactants = 0
					for (let reactant of newRecipeReactants.children) {
						let reactantSplit = reactant.textContent.split(" ");
						let reactantAmount = parseInt(reactantSplit[1].replace("[", "").replace("]", ""));
						totalAmountOfReactants += reactantAmount;
					}

					for (let reactant of newRecipeReactants.children) {
						let reactantSplit = reactant.textContent.split(" ");
						let reactantAmount = parseInt(reactantSplit[1].replace("[", "").replace("]", ""));
						let reactantName = reactantSplit[0];
						let newReactantAmount = Math.round((parseInt(searchValueSplit[0]) * reactantAmount) / totalAmountOfReactants);
						reactant.textContent = reactantName + " [" + newReactantAmount + "]";
						//debugger
						if (reactantHasRecipe(reactantName))
							showReactantsWithAmounts(reactant, totalAmountOfReactants, newReactantAmount);
					}

					newRecipe.classList.add("dynamic-recipe");
					newRecipeId.textContent = searchValueSplit[0] + " " + newRecipeId.textContent;
					recipe.after(newRecipe);
					newRecipe.style.display = "flex";
					

					break

				}

			}
		}


		let skippedRecipes = []

		if (!skipRegularSearch) {

			for (let recipe of recipes) {
				let recipeid = recipe.children[0];
				//if recipeid is equal to searchbar value, show recipe and all other recipes related to it
				let recipeName = recipeid.textContent.replace(':', '').toLowerCase();
				if (recipeName === searchBar.value.toLowerCase()) {
					recipe.style.display = "flex";
					// get the recipe's reactants


					showReactants(recipe, skippedRecipes);
				}


				else if (recipeid.textContent.toLowerCase().includes(searchBar.value.toLowerCase())) {
					recipe.style.display = "flex";
				} else {
					if (!skippedRecipes.includes(recipe)) {
						recipe.style.display = "none";
					}
				}
			}
		}

		for (let category of categories) {
			let categoryName = category.children[0];
			let catRecipes = []
			// get next sibling until it's not a reaction
			let sibling = category.nextElementSibling;
			while (sibling && sibling.classList.contains("reaction")) {
				catRecipes.push(sibling);
				sibling = sibling.nextElementSibling;
			}

			// if all reactions in category are hidden, hide category
			let allHidden = true;
			for (let r of catRecipes) {
				if (r.style.display === "flex") {
					allHidden = false;
					break;
				}
			}

			// if category name includes search term or not all reactions are hidden, show category
			if (categoryName.textContent.toLowerCase().includes(searchBar.value.toLowerCase()) || !allHidden) {
				category.style.display = "flex";
			} else {
				category.style.display = "none";
			}


		}
	}
	else if (searchBar.value.length === 0) {

	}


}

// changes current content to the content of the clicked category
function changeContent(category) {

	// hide all categories except the clicked one
	let categories = ["reactions", "cooking", "crafting", "construction", "lathes"]

	let navButtons = document.getElementsByClassName("nav-btn");

	for (let cat of categories) {
		if (cat === category) {
			document.getElementById(cat).classList.remove("hidden")
			for (let button of navButtons) {
				if (button.textContent.toLocaleLowerCase() === cat) {
					button.classList.add("active")
				} else {
					button.classList.remove("active")
				}
			}
		} else {
			document.getElementById(cat).classList.add("hidden")
		}
	}


}


function getActiveCategory() {
	let navButtons = document.getElementsByClassName("nav-btn");

	for (let button of navButtons) {
		if (button.classList.contains("active")) {
			return button.textContent.toLowerCase();
		}
	}
}


function toggleCategory(icon) {
	let category = icon.parentElement.parentElement;

	let category_recipes = category.getElementsByClassName("recipe");
	if (icon.classList.contains('toggled')) {
		icon.classList.remove('toggled');
		category.classList.add("untoggled");
	}
	else {
		icon.classList.add('toggled');
		category.classList.add("untoggled");
	}

	// for (recipe of category_recipes) {

	// 	if (recipe.classList.contains("fade")) {
	// 		recipe.classList.remove("fade")

	// 	} else {
	// 		recipe.classList.add("fade")

	// 	}
	// }
	var ri = 0
	var interval = setInterval(function () {
		if (ri < category_recipes.length) {
			if (category_recipes[ri].classList.contains("fade")) {
				category_recipes[ri].classList.remove("fade")
			} else {
				category_recipes[ri].classList.add("fade")
			}
			ri++
		} else {
			clearInterval(interval)
		}
	}, 1)
}


function bindAllIngredients() {
	let ingredients = document.getElementsByClassName("ingredient");
	for (let ingredient of ingredients) {
		ingredient.addEventListener("click", function () {
			let ingredientName = ingredient.textContent;
			searchBar.value = ingredientName;
			onInputSearchBar();
		});
	}
}

bindAllIngredients();