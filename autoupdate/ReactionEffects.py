class ReactionEffect:
    def __init__(self):
        pass

class ExplosionReactionEffect(ReactionEffect):
    def __init__(self, explosionType, maxIntensity, intensityPerUnit, intensitySlope, maxTotalIntensity):
        self.explosionType = explosionType
        self.maxIntensity = maxIntensity
        self.intensityPerUnit = intensityPerUnit
        self.intensitySlope = intensitySlope
        self.maxTotalIntensity = maxTotalIntensity

    def __str__(self):
        return str(self.__dict__)

    def to_dict(self):
        return {
            "explosionType": str(self.explosionType),
            "maxIntensity": str(self.maxIntensity),
            "intensityPerUnit": str(self.intensityPerUnit),
            "intensitySlope": str(self.intensitySlope),
            "maxTotalIntensity": str(self.maxTotalIntensity)
        }

class AreaReactionEffect(ReactionEffect):
    def __init__(self, duration, prototypeId, sound):
        self.duration = duration
        self.prototypeId = prototypeId
        self.sound = sound
    
    def __str__(self):
        return str(self.__dict__)
    
    def to_dict(self):
        return {
            "duration": self.duration,
            "prototypeId": self.prototypeId,
            "sound": self.sound
        }

class EmpReactionEffect(ReactionEffect):
    def __init__(self, rangePerUnit, maxRange, energyConsumption, duration):
        self.rangePerUnit = rangePerUnit
        self.maxRange = maxRange
        self.energyConsumption = energyConsumption
        self.duration = duration

    def __str__(self):
        return str(self.__dict__)
    
    def to_dict(self):
        return {
            "rangePerUnit": self.rangePerUnit,
            "maxRange": self.maxRange,
            "energyConsumption": self.energyConsumption,
            "duration": self.duration
        }

class FlashReactionEffect(ReactionEffect):
    def __init__(self):
        pass

    def __str__(self):
        return str(self.__dict__)
    
    def to_dict(self):
        return {}
    

class CreateEntityReactionEffect(ReactionEffect):
    def __init__(self, entity):
        self.entity = entity

    def __str__(self):
        return str(self.__dict__)
    
    def to_dict(self):
        return {
            "entity": self.entity
        }
    
class CreateGas(ReactionEffect):
    def __init__(self, gas):
        self.gas = gas

    def __str__(self):
        return str(self.__dict__)
    
    def to_dict(self):
        return {
            "gas": self.gas
        }


class PopupMessage(ReactionEffect):
    def __init__(self, visualType, messages, type):
        self.visualType = visualType
        self.messages = messages
        self.type = type
    
    def __str__(self):
        return str(self.__dict__)
    
    def to_dict(self):
        return {
            "visualType": self.visualType,
            "messages": self.messages,
            "type": self.type
        }
    