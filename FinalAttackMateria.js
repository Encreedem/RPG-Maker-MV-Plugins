/*
 * =============================================================================
 * Encreedem - Final Attack Materia
 * -----------------------------------------------------------------------------
 *  FinalAttackMateria.js
 * =============================================================================
 */
 
var Imported = Imported || {};
Imported['FinalAttackMateria'] = '0.01';

var VictorEngine = VictorEngine || {};
VictorEngine.FinalAttackMateria = VictorEngine.FinalAttackMateria || {};
VictorEngine.FinalAttackMateria.forceFinalAttackEventCode = 380;
VictorEngine.FinalAttackMateria.defaultTarget = -2; //-2 = last target, -1 = random, 0 or higher = target index

/*:
 * @plugindesc v0.01 - VE_MateriaSystem AddOn: Use a skill upon death.
 * @author Encreedem
 * =============================================================================
 * @help 
 * Check the VE MateriaSystem plugin for instructions on how to set up materias.
 * This plugin adds the effect "Final Attack" (case insensitive)
 * =============================================================================
 *  Materia (notetag for Materia Armors)
 * -----------------------------------------------------------------------------
 *  <materia>
 *   effect: final attack[, text]
 *   paired: final attack[, text]
 *  </materia>
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 *  E.: <materia>
 *       ap: 2000, 18000, 35000
 *       price: 42000
 *       elements: 2
 *       skills: 1:9, 2:11, 3:13
 *       effect: final attack
 *      </materia>
 *
 *      <materia>
 *       type: support
 *       paired: final attack
 *      </materia>
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 *  - Final Attack
 *  If a materia with skills has this effect or is paired with a final attack
 *  support materia, then the wearer will cast the materia's strongest available
 *  skill upon dying.
 */

(function() {
	//==========================================================================
	// VictorEngine
	//==========================================================================

	VictorEngine.FinalAttackMateria.getMateriaEffect = VictorEngine.MateriaSystem.getMateriaEffect;
	VictorEngine.MateriaSystem.getMateriaEffect = function(match, type) {
		var result = VictorEngine.FinalAttackMateria.getMateriaEffect(match, type);
		var part1 = '[ ]*:[ ]*(final attack)'; // after "effect" or "paired": " : final attack // TODO: maybe change "final attack", make the notetag name a constant or even a parameter.
		var part2 = "(?:[ ]*,[ ]*('[^\']*'|\"[^\"]*\"))?"; // optional text after part1: ", 'some optional text'
		var regex = new RegExp(type + part1 + part2, 'gi');
		while ((value = regex.exec(match[1])) !== null) {
			var effect = value[1].toLowerCase().trim();
			result[effect] = result[effect] || {};
			if (value[2]) {
				result[effect].text = value[2];
			}
		}
		return result;
	};

	VictorEngine.FinalAttackMateria.makeFinalAttackEventCode = function(battlerID, skillID, targetID) {
		var ret = {};
		ret.code = VictorEngine.FinalAttackMateria.forceFinalAttackEventCode;
		ret.indent = 0;
		var group = 1; //0=enemy,1=player
		ret.parameters = [group, battlerID,skillID,targetID];
		return ret;
	};

	//==========================================================================
	// Game_BattlerBase
	//==========================================================================

	VictorEngine.FinalAttackMateria.die = Game_BattlerBase.prototype.die;
	Game_BattlerBase.prototype.die = function() {
		VictorEngine.FinalAttackMateria.die.call(this);
		if (this.isActor())
		{
			this.useFinalAttackMaterias();
		}
	};

	//==========================================================================
	// Game_Actor
	//==========================================================================

	// Get this actor's materias that have an attached "final attack" effect.
	Game_Actor.prototype.getFinalAttackMaterias = function(stateId) {
		var ret = [];
		this.allMaterias().forEach(materia => {
			if (materia.isFinalAttack()) {
				ret.push(materia);
			}
		});
		this.pairedMateria().forEach(pair => {
			if (pair.main.isFinalPair()) {
				if (pair.left && pair.left.skills()) {
					ret.push(pair.left);
				}
				if (pair.right && pair.right.skills()) {
					ret.push(pair.right);
				}
			}
		});

		return ret;
	};

	Game_Actor.prototype.queueFinalAttackSkills = function(skillIds) {
		skillIds = skillIds.filter(function(skillID) {
			return typeof skillID == "number";
		});
		
		var battlerID = this._actorId;
		var target = VictorEngine.FinalAttackMateria.defaultTarget;
		var finalAttackEventCodes = skillIds.map(function(skillID) {
			return VictorEngine.FinalAttackMateria.makeFinalAttackEventCode(battlerID, skillID, target);
		});

		if (finalAttackEventCodes.length > 0) {
			$gameTroop._interpreter.insertEvents(finalAttackEventCodes);
		}
	};

	// Get this actor's final attack materias and use their respective skills.
	Game_Actor.prototype.useFinalAttackMaterias = function() {
		// Get all materias whose strongest skill shall be used.
		var affectedMaterias = this.getFinalAttackMaterias();
		if (affectedMaterias.length == 0) {
			return;
		}

		// Get the respective strongest learned skill.
		var finalAttackSkills = affectedMaterias.map(function(materia) {
			var level = materia.level();
			var ret;
			// Get the highest available skill from this materia.
			while (ret === undefined && level > 0) {
				// Get the skill with the highest level. If no skill has been
				// learned at that level then reduce by 1 and look again.
				ret = materia.skills()[level--];
			}
			return ret;
		});
		// Queue the skills as forced actions (ignoring death).
		this.queueFinalAttackSkills(finalAttackSkills);
	};

	//==========================================================================
	// Game_Interpreter
	//==========================================================================
	Game_Interpreter.prototype.insertEvents = function(eventList) {
		if (this.isRunning()) {
			if (this._childInterpreter) {
				this._childInterpreter.insertEvents(eventList);
			}
			else {
				this.setupChild(eventList, null);
			}
		}
		else {
			this.setup(eventList);
		}
	};

	// Force Action Ignoring Death
	Game_Interpreter.prototype.command380 = function() {
    	this.iterateBattler(this._params[0], this._params[1], function(battler) {
			battler.forceAction(this._params[2], this._params[3]);
			BattleManager.forceAction(battler);
			this.setWaitMode('action');
		}.bind(this));
		return true;
	};
})();

//=============================================================================
// Game_Materia
//=============================================================================

Game_Materia.prototype.isFinalAttack = function() {
	return this.isEffect('final attack');
}

Game_Materia.prototype.isFinalPair = function() {
	return this.isPaired('final attack');
}