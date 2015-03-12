function generateIds(idPrefixes) {
	var idResult = [];
	
	idPrefixes.each(function(onePrefix) {
		var idNum = 0;
		do {
			tempDivId = onePrefix + '_' + idNum;
			idNum++;
		} while ($(tempDivId));
		idResult.push(tempDivId);
	}.bind(this));
	
	return idResult;
}

var Autocompleter = Class.create();
Autocompleter.prototype = Object.extend(Autocompleter.prototype, {
	/**
	 * @param string elemId
	 * @param array options
	 * 		mainDivId - DIV id for querying autocompleter
	 * 		queryResultId - hidden field to query all selected results
	 * 		requestUrl - from which resource getting JSON
	 * 		firstText - message, identifies text tip
	 * 		autocompleteKey - key from JSON string to autocomplete by
	 * 		autocompleteValue - value from JSON string to autocomplete by
	 * 		matchesLength - count of matches in matches list
	 */
	initialize: function(options) {
		this.effectInAction = false;
		this.autocompleterStatus = 0;
		this.hiddenInputArray = [];
		this.selectedMatch = null;
		this.matchesCount = 0;
		
		this.options = {
			requestUrl: '',
			firstText: 'Type some text',
			autocompleteValue: '',
			matchesLength: 10
		};
		Object.extend(this.options, options || {});
		
		if (this.options.autocompleteKey == undefined || this.options.autocompleteKey == '') {
			this.options.autocompleteKey = this.options.autocompleteValue;
		}
		
		this.hiddenSubmit = $(this.options.autocompleteFieldId);
		
		this.render();
	},
	
	render: function() {
		// Turns form input to hidden
		this.hiddenSubmit.hide();
		
		// Creates main div container and inserts it after input field
		var mainDivId = generateIds([this.options.autocompleteFieldId+'Container']);
		this.mainDiv = new Element('div', {'id': mainDivId[0], 'class': 'autocomplete-main-div'});
		this.hiddenSubmit.insert({
			after: this.mainDiv
		});
		this.mainDiv.observe('click', this.onClickMainDiv.bind(this));
		this.mainDivWidth = parseInt(this.mainDiv.getWidth() - 2);
		
		// Creates input field
		this.inputField = new Element("input", {'type':'text', 'class':'autocomplete-float-input', 'value':'', 'realvalue': ''});
		this.inputField.observe('focus', this.onFocusInput.bind(this));
		this.inputField.observe('blur', this.onBlurInput.bind(this));
		if (Prototype.Browser.IE) {
			this.inputField.observe('keyup', this.getCurrentInputValue.bind(this));
		}
		else {
			this.inputField.observe('keypress', this.onKeypressInputNonIE.bind(this));
		}
		this.inputFieldDiv = new Element("div", {'class': 'autocomplete-float-input-div'}).update(this.inputField);
		
		// Creates results container
		this.resultsContainer = new Element("div", {'class': 'autocomplete-float-results-div'});
		this.resultsContainer.insert(this.inputFieldDiv);
		
		// Creates inner div, that drag main div container
		this.mainDivContent = new Element("div", {'class': 'autocomplete-main-div-content'}).insert(this.resultsContainer);
		this.mainDiv.update(this.mainDivContent);
		this.mainDivContent.insert(this.resultsContainer);
		
		// Creates message element for showing additionnal info
		this.messageElement = new Element("div", {'class': 'autocomplete-message'}).update(this.options.firstText);
		this.messageElement.setStyle({'width': this.mainDivWidth + 'px'});
		
		// Creates template of list matches div
		var divIds = generateIds(['matches_div', 'matches_text']);
		var matchesTemplate = new Template("<div id='#{matches_id}' class='autocomplete-matches-div' style='display:none'><table cellpadding='0' cellspacing='0'><tr><td><div id='#{matches_text_id}'></div></td></tr></table></div>");
		$(document.body).insert({
			bottom: matchesTemplate.evaluate({
				matches_id: divIds[0],
				matches_text_id: divIds[1]
			})
		});
		
		this.matchesDiv = $(divIds[0]);
		this.matchesDivText = $(divIds[1]);
		
		// Sets the first message
		this.matchesDivText.update(this.messageElement);
		
		this.setMainDivHeight();
		this.setAutocompleterPosition();
	},
	
	onFocusInput: function(event) {
		this.setAutocompleterPosition();
		this.getCurrentInputValue(event);
		this.changeAutocompleteState();
	},
	
	onBlurInput: function() {
		this.changeAutocompleteState();
	},
	
	onKeypressInputNonIE: function(event) {
		setTimeout(this.getCurrentInputValue.bind(this, event), 100);
	},
	
	onClickMainDiv: function() {
		this.inputField.focus();
	},
	
	setAutocompleterPosition: function() {
		this.matchesDiv.clonePosition(this.mainDiv, {setHeight: false, offsetLeft: 0, offsetTop: this.mainDiv.getHeight()});
	},
	
	setMainDivHeight: function() {
		this.mainDiv.setStyle({
			'height': parseInt(this.mainDivContent.getHeight()) + 'px'
		});
	},
	
	getCurrentInputValue: function(event) {
		if (event && event.keyCode) {
			switch(event.keyCode) {
				case Event.KEY_UP:
					if (this.matchesCount != 0) {
						if (this.selectedMatch == null) {
							var descedantsArray = this.matchesDivText.immediateDescendants();
							this.selectedMatch = descedantsArray.last();
							if (this.selectedMatch != null) 
								this.currentMatch();
						}
						else {
							if (this.matchesCount > 1) {
								this.previousMatch();
							}
							else {
								this.selectedMatch = this.matchesDivText.firstDescendant();
								this.currentMatch();
							}
						}
					}
					event.stop();
					break;
					
				case Event.KEY_DOWN:
					if (this.matchesCount != 0) {
						if (this.selectedMatch == null) {
							this.selectedMatch = this.matchesDivText.firstDescendant();
							if (this.selectedMatch != null) 
								this.currentMatch();
						}
						else {
							if (this.matchesCount > 1) {
								this.nextMatch();
							}
							else {
								this.selectedMatch = this.matchesDivText.firstDescendant();
								this.currentMatch();
							}
						}
					}
					event.stop();
					break;
					
				case Event.KEY_RETURN: 
					if (this.selectedMatch != null) {
						this.insertSelectedMatch(this.selectedMatch);
					}
					else {
						this.insertSelectedMatch(this.inputField);
					}
					this.selectedMatch = null;
					event.stop();
					break;
			}
		}
		
		if (this.inputField.readAttribute('realvalue') != this.inputField.value) {
			this.inputField.writeAttribute({'realvalue': this.inputField.value});
			this.getMatches();
		}
	},
	
	currentMatch: function() {
		this.selectedMatch.removeClassName('autocomplete-match-list-d');
		this.selectedMatch.addClassName('autocomplete-match-list-a');
	},
	
	nextMatch: function() {
		var newMatch = this.selectedMatch.next();
		
		if (newMatch == null) {
			var allSiblings = this.matchesDivText.immediateDescendants();
			newMatch = allSiblings.first();
			
		}
		
		newMatch.removeClassName('autocomplete-match-list-d');
		newMatch.addClassName('autocomplete-match-list-a');
		this.selectedMatch.removeClassName('autocomplete-match-list-a');
		this.selectedMatch.addClassName('autocomplete-match-list-d');
		this.selectedMatch = newMatch;
	},
	
	previousMatch: function() {
		var newMatch = this.selectedMatch.previous();
		
		if (newMatch == null) {
			var allSiblings = this.matchesDivText.immediateDescendants();
			newMatch = allSiblings.last();
		}
		
		newMatch.removeClassName('autocomplete-match-list-d');
		newMatch.addClassName('autocomplete-match-list-a');
		this.selectedMatch.removeClassName('autocomplete-match-list-a');
		this.selectedMatch.addClassName('autocomplete-match-list-d');
		this.selectedMatch = newMatch;
	},
	
	addToHiddenValue: function(addText) {
		this.hiddenInputArray.push(addText);
		this.hiddenSubmit.value = this.hiddenInputArray.join(',');
	},
	
	removeFromHiddenValue: function(removeText) {
		this.hiddenInputArray = this.hiddenInputArray.without(removeText);
		this.hiddenSubmit.value = this.hiddenInputArray.join(',');
	},
	
	getMatches: function() {
		if (this.inputField.value != '') {
			new Ajax.Request(this.options.requestUrl, {
				onSuccess: this.parseResponse.bind(this)
			});
		}
		else {
			this.messageElement.update(this.options.firstText);
			this.matchesDivText.update(this.messageElement);
		}
	},
	
	parseResponse: function(result) {
		this.matchesCount = 0;
		var reg_exp = new RegExp(this.inputField.readAttribute('realvalue'), 'i');
		
		this.matchesDivText.update('');
		
		var resultJSON = result.responseText.evalJSON();
		resultJSON.each(function(record) {
			if (record[this.options.autocompleteValue].toLowerCase().include(this.inputField.readAttribute('realvalue').toLowerCase())) {
				if (this.matchesCount < this.options.matchesLength) {
					var visualValue = record[this.options.autocompleteValue].gsub(reg_exp, "<span>#{0}</span>");
					
					var currentMatchDiv = new Element("div").update(visualValue);
					currentMatchDiv.setStyle({
						'width': this.mainDivWidth + 'px'
					});
					
					var currentMatchLink = new Element("a", {
						'href': 'javascript:void(0)',
						'class': 'autocomplete-match-list-d',
						'realkey': record[this.options.autocompleteKey],
						'realvalue': record[this.options.autocompleteValue]
					});
					
					currentMatchLink.update(currentMatchDiv);
					this.matchesDivText.insert({
						bottom: currentMatchLink
					});
					
					currentMatchLink.observe('click', this.insertSelectedMatch.bind(this, currentMatchLink));
					
					this.matchesCount++;
				}
			}
			/*
			// If using overflow
			if (this.matchesCount == this.options.matchesLength) {
				this.matchesDiv.setStyle({
					'height': (currentMatchDiv.getHeight() * this.options.matchesLength) + 'px'
				});
			}
			*/
		}.bind(this));
		
		if (this.matchesCount == 0) {
			this.messageElement.update('No matches found');
			this.matchesDivText.update(this.messageElement);
		}
	},
	
	insertSelectedMatch: function(currentMatch) {
		var matchSourceKey = currentMatch.readAttribute('realkey');
		var matchSourceValue = currentMatch.readAttribute('realvalue');
		
		if (matchSourceKey == null || matchSourceKey == '')
			matchSourceKey = matchSourceValue;
		
		this.addToHiddenValue(matchSourceKey);
		
		var containerDiv = new Element("div", {'class': 'autocomplete-match-container-div'});
		var leftTopSpan = new Element("span", {'class': 'autocompleter-left-top-match'});
		var rightTopSpan = new Element("span", {'class': 'autocompleter-right-top-match'});
		var rightBottomSpan = new Element("span", {'class': 'autocompleter-right-bottom-match'});
		var leftBottomSpan = new Element("span", {'class': 'autocompleter-left-bottom-match'});
		var deleteImage = new Element("p", {'class': 'autocompleter-delete-match'}).update("X");
		var containerHref = new Element("a", {'href': 'javascript: void(0)', 'class': 'autocomplete-hover-match', 'container_value': matchSourceKey});
		
		leftTopSpan.insert(rightTopSpan);
		rightTopSpan.insert(rightBottomSpan);
		rightBottomSpan.insert(leftBottomSpan);
		leftBottomSpan.insert(matchSourceValue);
		leftBottomSpan.insert(deleteImage);
		containerHref.update(leftTopSpan);
		containerDiv.update(containerHref);
		
		deleteImage.observe('click', this.onClickDelete.bind(this, containerDiv));
		
		this.inputFieldDiv.insert({
			before: containerDiv
		});
		
		this.setMainDivHeight();
		this.setAutocompleterPosition();
		this.inputField.value = '';
	},
	
	onClickDelete: function(removeElement) {
		this.removeFromHiddenValue(removeElement.getAttribute('container_value'));
		removeElement.remove();
		this.setMainDivHeight();
		this.setAutocompleterPosition();
	},
	
	changeAutocompleteState: function () {
		if (this.effectInAction == false) {
			if (this.autocompleterStatus == 0) {
				this.show();
			}
			else {
				this.hide();
			}
		}
		else {
			setTimeout(this.changeAutocompleteState.bind(this), 300);
		}
	},
	
	show: function() {
		this.effectInAction = true;
		new Effect.Appear(this.matchesDiv, {duration:0.3});
		setTimeout(function(){this.effectInAction = false; this.autocompleterStatus = 1;}.bind(this), 300);
	},
	
	hide: function () {
		this.effectInAction = true;
		new Effect.Fade(this.matchesDiv, {duration:0.3});
		setTimeout(function(){this.effectInAction = false; this.autocompleterStatus = 0;}.bind(this), 300);
	}
}
);