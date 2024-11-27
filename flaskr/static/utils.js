const searchBar = document.getElementById("search-bar");


function clearSearchBar() {
	document.getElementById("search-bar").value = "";
	let recipes = document.getElementsByClassName("recipe");
	for (let recipe of recipes) {
		recipe.style.display = "flex";
	}
	let categories = document.getElementsByClassName("category-header");
	for (let category of categories) {
		category.style.display = "block";
	}

	//clear all dynamically created recipes for the amount search
	let dynamicRecipes = document.getElementsByClassName("dynamic-recipe");
	for (let recipe of dynamicRecipes) {
		recipe.remove();
	}

	hideSuggestions();
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

function cloneRecipe(recipe, searchAmount) {
	debugger
	let amountOfProduct = searchAmount;
	let recipeName = recipe.id;
	let newRecipe = document.getElementById(recipeName).cloneNode(true)
	newRecipe.id = amountOfProduct+ "u" + recipeName;
	let rightside = newRecipe.children[1].children[2];
	rightside.innerHTML = "";
	let leftside = newRecipe.children[1].children[0];
	leftside.innerHTML = "";

	for (let product in recipe.products) {
		let productName = product
		let productP = document.createElement("a");
		productP.classList.add("ingredient");
		productP.textContent = productName + " [" + amountOfProduct + "]";
		rightside.appendChild(productP);
	}

	let totalAmountOfReactants = 0
	for (let reactant in recipe.reactants) {
		let reactantAmount = recipe.reactants[reactant]['amount'];
		totalAmountOfReactants += reactantAmount;
	}

	for (let reactant in recipe.reactants) {
		let newReactantAmount = Math.round((amountOfProduct * recipe.reactants[reactant]['amount']) / totalAmountOfReactants);
		//debugger
		if (reactantHasRecipe(reactant))
			{
			let reactantP = document.createElement("a");
			reactantP.textContent = reactant + " [" + newReactantAmount + "]";
			reactantP.classList.add("ingredient");
			leftside.appendChild(reactantP);
			cloneRecipe( lookupRecipe(reactant), newReactantAmount);
		} else {
			let reactantP = document.createElement("p");
			reactantP.textContent = reactant + " [" + newReactantAmount + "]";
			reactantP.classList.add("ingredient");
			leftside.appendChild(reactantP);
		}
	}

	newRecipe.classList.add("dynamic-recipe");
	newRecipe.children[0].textContent = amountOfProduct + "u " + newRecipe.children[0].textContent;
	document.getElementById(recipeName).after(newRecipe);
	newRecipe.style.display = "flex";
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
				product.textContent = productName + " [" + Math.round(amount) + "]";
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
				if (reactantHasRecipe(reactantName))
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

function showSuggestions(recipes) {
	if (recipes.length === 0) {
		hideSuggestions();
		return;
	}

	let suggestions = document.createElement("div");
	suggestions.classList.add("suggestions");
	suggestions.style.top = searchBar.offsetHeight + 4 + "px";
	suggestions.style.width = searchBar.offsetWidth + "px";
	suggestions.innerHTML = "";
	for (let recipe of recipes) {
		let recipeData = lookupRecipe(recipe);
		let suggestion = document.createElement("div");
		suggestion.classList.add("suggestion");
		suggestion.tabIndex = 0;
		suggestion.addEventListener("click", function () {
			recipe = recipe.replace(/\s/g, '');
			searchBar.value = recipe;
			changeContent(recipeData.key);
			onInputSearchBar();
			hideSuggestions();
			setContentHeight();
		});

		suggestion.addEventListener("keydown", function (event) {
			if (event.key === "Enter") {
				//strip recipe of whitespace
				recipe = recipe.replace(/\s/g, '');
				searchBar.value = recipe;
				let recipeData = lookupRecipe(recipe);
				changeContent(recipeData.key);
				onInputSearchBar();
				hideSuggestions();
				setContentHeight();
			}
		});

		suggestion.textContent = recipeData.key + " > " + recipeData.category + " > " + recipe;
		suggestions.appendChild(suggestion);
	}

	searchBar.parentNode.insertBefore(suggestions, searchBar.nextSibling);
}

function hideSuggestions() {
	let suggestions = document.getElementsByClassName("suggestions");
	for (let suggestion of suggestions) {
		suggestion.remove();
	}

}

function lookupRecipe(recipeName) {
	let recipe = allDataArray.find(recipe => recipe.id === recipeName);
	return recipe;
}

function showRecipePage(recipeName) {
	debugger
	let recipeData = lookupRecipe(recipeName);

	let content = document.getElementsByClassName("content")[0];

	hideAllContent();

	searchBar.value = recipeName;
	let recipePage = document.createElement("div");

	recipePage.id = recipeName + "Page";

	recipePage.classList.add("recipe-page");
	let recipePageTitle = document.createElement("h1");
	recipePageTitle.textContent = recipeName;

	let recipePageContent = document.createElement("div");
	recipePageContent.classList.add("recipe-page-content");

	let recipePageReactants = document.createElement("div");
	recipePageReactants.classList.add("recipe-page-reactants");
	let recipePageProducts = document.createElement("div");
	recipePageProducts.classList.add("recipe-page-products");

	let reactantsTitle = document.createElement("h2");
	reactantsTitle.textContent = "Reactants";
	let productsTitle = document.createElement("h2");
	productsTitle.textContent = "Products";

	recipePageReactants.appendChild(reactantsTitle);
	recipePageProducts.appendChild(productsTitle);

	for (let reactant in recipeData.reactants) {
		let reactantElement = document.createElement("p");
		reactantElement.classList.add("ingredient");
		reactantElement.textContent = reactant
		let reactantAmount = document.createElement("span");
		reactantAmount.classList.add("amount");
		reactantAmount.textContent = recipeData.reactants[reactant]['amount'] + "u";
		recipePageReactants.appendChild(reactantElement);
		reactantElement.appendChild(reactantAmount);
	}

	for (let product in recipeData.products) {
		let productElement = document.createElement("p");
		productElement.classList.add("ingredient");
		productElement.textContent = product;
		let productAmount = document.createElement("span");
		productAmount.classList.add("amount");
		productAmount.textContent = recipeData.products[product]['amount'] + "u";
		recipePageProducts.appendChild(productElement);
		productElement.appendChild(productAmount);
	}

	recipePageContent.appendChild(recipePageReactants);
	recipePageContent.appendChild(recipePageProducts);

	recipePage.appendChild(recipePageContent);
	content.appendChild(recipePage);
	hideSuggestions();
}

function hideAllContent() {
	let categories = document.getElementsByClassName("category-header");
	let recipes = document.getElementsByClassName("recipe");
	// first, show all recipes and categories
	for (let recipe of recipes) {
		recipe.style.display = "flex";
	}
	for (let category of categories) {
		category.style.display = "block";
	}
}

function onInputSearchBar() {

	let activeCategory = document.getElementById(getActiveCategory());
	let recipes = activeCategory.getElementsByClassName("recipe");
	let categories = document.getElementsByClassName("category-header");

	let recipeSuggestions = allDataArray;

	hideSuggestions();

	hideAllContent();

	// delete all dynamically created recipes for the amount search
	let dynamicRecipes = document.getElementsByClassName("dynamic-recipe");
	for (let recipe of dynamicRecipes) {
		recipe.remove();
	}

	if (searchBar.value.length > 0) {
		for (let recipe of recipes) {
			recipe.style.display = "none";
		}

		for (let category of categories) {
			category.style.display = "none";
		}

		let skipRegularSearch = false;
		// filter recipes based on search value
		recipeSuggestions = recipeSuggestions.filter(recipe => recipe.id.toLowerCase().includes(searchBar.value.toLowerCase()));

		if (recipeSuggestions.length > 0) {

			if (recipeSuggestions.length > 10) {
				recipeSuggestions = recipeSuggestions.slice(0, 10);
			}

			showSuggestions(recipeSuggestions.map(recipe => recipe.id));
		}


		// if search value in the format "{Integer}u {string}" show the recipe with the corresponding amounts
		let searchValueSplit = searchBar.value.toLowerCase().split(" ");
		if (searchValueSplit.length === 2 && !isNaN(parseInt(searchValueSplit[0].split('u')[0])) && searchValueSplit[1].length > 0) {
			for (let recipe of allDataArray) {
				let recipeName = recipe.id;
				if (recipeName.toLowerCase() === searchValueSplit[1].toLowerCase()) {
					skipRegularSearch = true;
					cloneRecipe(recipe, searchValueSplit[0].split('u')[0]);
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
					recipeSuggestions.push(recipeid.textContent.replace(':', ''));
				} else {
					if (!skippedRecipes.includes(recipe)) {
						recipe.style.display = "none";
					}
				}
			}
		}

		for (let category of categories) {
			let categoryName = category.getElementsByTagName("h2")[0];
			let catRecipes = []
			// get next sibling until it's not a reaction
			let sibling = category.nextElementSibling;
			while (sibling && sibling.classList.contains("recipe")) {
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
			if (!allHidden) {
				category.style.display = "block";
			} else {
				category.style.display = "none";
			}

		}


	}
	else if (searchBar.value.length === 0) {
		hideSuggestions();
	}

	setContentHeight();

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

function changeViewType(viewType) {
	let categories = document.getElementsByClassName("category-container");
	let gridViewBtn = document.getElementById("grid-view-btn");
	let listViewBtn = document.getElementById("list-view-btn");
	if (viewType === "list") {
		for (let category of categories) {
			category.classList.add("list-view");
			category.classList.remove("grid-view");
			gridViewBtn.classList.remove("active");
			listViewBtn.classList.add("active");
		}
	
	} else if (viewType === "grid") {
		for (let category of categories) {
			category.classList.add("grid-view");
			category.classList.remove("list-view");
			gridViewBtn.classList.add("active");
			listViewBtn.classList.remove("active");
		}
	}

}

function openHelpModal() {
	let modal = document.getElementById("help-modal");
	modal.style.display = "block";

	let span = modal.getElementsByClassName("close")[0];

	// Close the modal when the user clicks on <span> (x)
    span.onclick = function() {
        modal.style.display = "none";
    }

    // Close the modal when the user clicks anywhere outside of the modal
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
}

function closeHelpModal() {
	let modal = document.getElementById("help-modal");
	modal.style.display = "none";
}


function bindAllIngredients() {
	let ingredients = document.getElementsByClassName("ingredient");
	for (let ingredient of ingredients) {
		ingredient.addEventListener("click", function () {
			let ingredientName = ingredient.textContent;
			searchBar.value = ingredientName;
			onInputSearchBar();
			hideSuggestions();
		});
	}
}

function bindAllRecipeLinks() {
	let recipes = document.getElementsByClassName("recipe");
	for (let recipe of recipes) {
		recipe_link = recipe.getElementsByClassName("recipe-link")[0];
		console.log(recipe)
		recipe_link.addEventListener("click", function (event) {
			debugger
			let recipeName = event.target.innerText;
			searchBar.value = recipeName;
			onInputSearchBar();
			hideSuggestions();
		});
	}
}

function bindSearchBarHotkeys() {
	searchBar.addEventListener("keydown", function (event) {
		if (event.key === "Tab") {
			event.preventDefault();
			const suggestionBox = document.getElementsByClassName("suggestions")[0];
			const firstSuggestion = suggestionBox.children[0];

			if (firstSuggestion) {
				firstSuggestion.focus()
			}
		}
		if (event.key === "Enter") {
			onInputSearchBar();
			hideSuggestions();
		}

		else if (event.key === "Escape") {
			clearSearchBar();
			hideSuggestions();
		}
	});
}

// clicking anywhere on the page hides the suggestions
document.addEventListener("click", function (event) {
	if (event.target !== searchBar) {
		hideSuggestions();
	}
});

// set height of content to fit the screen
function setContentHeight() {
	let content = document.getElementsByClassName("content")[0];
	let nav = document.getElementsByClassName("nav")[0];
	let footer = document.getElementsByClassName("footer")[0];
	let header = document.getElementsByClassName("header")[0];
	content.style.maxHeight = window.innerHeight - header.offsetHeight - nav.offsetHeight - footer.offsetHeight - 41 + "px";
}

setContentHeight();

bindSearchBarHotkeys()

bindAllIngredients();

bindAllRecipeLinks();