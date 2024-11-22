class ExplosionReactionEffect:
	def __init__(self, explosionType, maxIntensity, intensityPerUnit, intensitySlope, maxTotalIntensity):
		self.explosionType = explosionType
		self.maxIntensity = maxIntensity
		self.intensityPerUnit = intensityPerUnit
		self.intensitySlope = intensitySlope
		self.maxTotalIntensity = maxTotalIntensity

	def __str__(self):
		return str(self.__dict__)

class AreaReactionEffect:
	def __init__(self, duration, prototypeId, sound):
		self.duration = duration
		self.prototypeId = prototypeId
		self.sound = sound
	
	def __str__(self):
		return str(self.__dict__)

class EmpReactionEffect:
	def __init__(self, rangePerUnit, maxRange, energyConsumption, duration):
		self.rangePerUnit = rangePerUnit
		self.maxRange = maxRange
		self.energyConsumption = energyConsumption
		self.duration = duration

	def __str__(self):
		return str(self.__dict__)


class CreateEntityReactionEffect:
	def __init__(self, entity):
		self.entity = entity

	def __str__(self):
		return str(self.__dict__)
	
class CreateGas:
	def __init__(self, gas):
		self.gas = gas

	def __str__(self):
		return str(self.__dict__)


class PopupMessage:
	def __init__(self, visualType, messages, type):
		self.visualType = visualType
		self.messages = messages
		self.type = type
	
	def __str__(self):
		return str(self.__dict__)