"""The data contract: the shape of every file the pipeline writes to ``data/<server>/``.

These models are the single source of truth. ``ss14help-pipeline schema`` exports them to
``schema/ss14help.schema.json``, and ``packages/schema`` generates the TypeScript types from that.

Conventions:
- JSON keys are camelCase (``minTemp``); Python attributes are snake_case.
- Every field is always written, so optional values appear as ``null`` instead of being left out.
- Ids are SS14 prototype ids (``Bicaridine``, ``FoodBreadBun``) and are case-sensitive. Maps
  keyed by id use plain ``str`` keys (no pattern) so the generated TypeScript stays clean; the
  validation stage checks that every key resolves.
- Amounts are reagent units (u). SS14 stores them as fixed-point with 2 decimals.

Bump ``SCHEMA_VERSION`` whenever these models change. A major bump means the frontend must be
updated before it can read the new data.
"""

from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

SCHEMA_VERSION = "1.0.0"

PrototypeId = Annotated[str, Field(min_length=1, pattern=r"^\S+$")]
"""An SS14 prototype id. Ids never contain whitespace."""

Amount = Annotated[float, Field(gt=0)]
"""A positive quantity of reagent, in units (u)."""

HexColor = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$")]


class ContractModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
        extra="forbid",
        frozen=True,
        json_schema_serialization_defaults_required=True,
    )


class Origin(ContractModel):
    """Where a prototype came from in the game repository."""

    source_file: str = Field(
        description="Path relative to Resources/Prototypes, e.g. 'Recipes/Reactions/medicine.yml'."
    )
    server_only: bool = Field(
        default=False,
        description="True when the id doesn't exist in the upstream (Wizard's Den) snapshot.",
    )


# --- reagents.json ---------------------------------------------------------------------------


class Reagent(Origin):
    id: PrototypeId
    name: str = Field(description="Localized display name; falls back to the id.")
    desc: str | None = None
    physical_desc: str | None = None
    group: str | None = Field(default=None, description="Reagent group, e.g. 'Medicine', 'Foods'.")
    color: HexColor | None = None


class ReagentsFile(ContractModel):
    reagents: list[Reagent]


# --- entities.json ---------------------------------------------------------------------------


class Entity(Origin):
    """A game entity referenced by a recipe or source (cooking ingredients, results, produce)."""

    id: PrototypeId
    name: str = Field(description="Display name; falls back to the id.")
    desc: str | None = None


class EntitiesFile(ContractModel):
    entities: list[Entity]


# --- recipes.json ----------------------------------------------------------------------------


class Reactant(ContractModel):
    amount: Amount
    catalyst: bool = Field(
        default=False, description="Must be present for the reaction but isn't consumed."
    )


class Reaction(Origin):
    id: PrototypeId
    category: str = Field(
        description="Grouping for navigation, from the source file name, e.g. 'medicine', 'drinks'."
    )
    reactants: dict[str, Reactant] = Field(min_length=1)
    products: dict[str, Amount] = Field(
        description="Empty for reactions that only have effects (e.g. explosions)."
    )
    min_temp: float | None = Field(default=None, description="Kelvin.")
    max_temp: float | None = Field(default=None, description="Kelvin.")
    mixers: list[PrototypeId] = Field(
        default_factory=list, description="mixingCategory ids; any one of them works."
    )
    quantized: bool = Field(default=False, description="Only runs in whole multiples.")
    priority: int = 0
    effects: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Raw reaction effects, tag kept as '_type'. Displayed as text only.",
    )


class CookingRecipe(Origin):
    id: PrototypeId
    name: str
    device: str = Field(default="Microwave", description="Cooking device, e.g. 'Microwave'.")
    time: float | None = Field(default=None, ge=0, description="Seconds; null for instant.")
    solids: dict[str, Annotated[int, Field(gt=0)]] = Field(
        default_factory=dict, description="Entity id → count."
    )
    reagents: dict[str, Amount] = Field(default_factory=dict)
    result: PrototypeId = Field(description="Entity id of the cooked item.")
    group: str | None = None
    secret: bool = False


class Mixer(ContractModel):
    id: PrototypeId
    name: str = Field(description="Localized verb or name, e.g. 'centrifuge'.")


class RecipesFile(ContractModel):
    reactions: list[Reaction]
    cooking: list[CookingRecipe]
    mixers: list[Mixer]


# --- sources.json ----------------------------------------------------------------------------


class Source(ContractModel):
    """Reagents obtainable from an entity by grinding or juicing it."""

    entity: PrototypeId = Field(description="Entity id; its name is in entities.json.")
    grind: dict[str, Amount] | None = None
    juice: dict[str, Amount] | None = None


class SourcesFile(ContractModel):
    sources: list[Source]


# --- manifest.json ---------------------------------------------------------------------------


class PipelineWarning(ContractModel):
    code: str = Field(description="Machine-readable, e.g. 'duplicate-id', 'unknown-tag'.")
    message: str
    source_file: str | None = None


class Manifest(ContractModel):
    schema_version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    server: str = Field(description="Server id from servers.yaml.")
    server_name: str
    repo: str
    branch: str
    sha: str = Field(pattern=r"^[0-9a-f]{40}$")
    commit_date: datetime
    generated_at: datetime
    counts: dict[str, int] = Field(description="File/collection name → number of items.")
    warnings: list[PipelineWarning] = Field(default_factory=list)


DATA_FILES: dict[str, type[ContractModel]] = {
    "manifest.json": Manifest,
    "reagents.json": ReagentsFile,
    "entities.json": EntitiesFile,
    "recipes.json": RecipesFile,
    "sources.json": SourcesFile,
}
"""Every file in a ``data/<server>/`` snapshot and the model it must validate against."""
