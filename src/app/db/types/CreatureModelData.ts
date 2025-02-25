// Source https://github.com/wowdev/WoWDBDefs/blob/master/definitions/CreatureModelData.dbd
type CreatureModelData = {
	ID: number,
	GeoBox: Array<number>,
	Flags: number,
	FileDataID: number,
	BloodID: number,
	FootprintTextureID: number,
	FootprintTextureLength: number,
	FootprintTextureWidth: number,
	FootprintParticleScale: number,
	FoleyMaterialID: number,
	FootstepCameraEffectID: number,
	DeathThudCameraEffectID: number,
	SoundID: number,
	SizeClass: number,
	CollisionWidth: number,
	CollisionHeight: number,
	WorldEffectScale: number,
	CreatureGeosetDataID: number,
	HoverHeight: number,
	AttachedEffectScale: number,
	ModelScale: number,
	MissileCollisionRadius: number,
	MissileCollisionPush: number,
	MissileCollisionRaise: number,
	MountHeight: number,
	OverrideLootEffectScale: number,
	OverrideNameScale: number,
	OverrideSelectionRadius: number,
	TamedPetBaseScale: number,
	MountScaleOtherIndex: Array<number>,
	MountScaleSelf: number,
	MountScaleOther: Array<number>
}

export default CreatureModelData;