extends Node3D

@onready var camera_rig: Node3D = $CameraRig
@onready var camera: Camera3D = $CameraRig/Camera3D
@onready var legacy_water_plane: MeshInstance3D = $OceanSlot/WaterPlane
@onready var legacy_dog: MeshInstance3D = $BlackLabSlot/DogBlockout
@onready var legacy_alhena: MeshInstance3D = $AlhenaSlot/AlhenaBlockout
@onready var legacy_bar: MeshInstance3D = $BeachBarSlot/BarBlockout
@onready var legacy_beach: MeshInstance3D = $ShorelineEnvironmentSlot/BeachPlane
@onready var world_environment: WorldEnvironment = $WorldEnvironment
@onready var sun_light: DirectionalLight3D = $Sun

const DOG_WALK_RADIUS := 1.55
const WATER_ROWS := 78
const WATER_COLS := 132
const SHORE_ROWS := 42
const SHORE_COLS := 92

var orbit_yaw := 0.0
var line_cast := false
var bite_timer := 0.0
var ocean_mesh: MeshInstance3D
var bobber: MeshInstance3D
var line_mesh: MeshInstance3D
var dog_root: Node3D
var dog_tail: Node3D
var dog_head: Node3D
var dog_legs: Array[Node3D] = []
var alhena_root: Node3D
var alhena_arm_l: Node3D
var alhena_arm_r: Node3D
var foam_ribbons: Array[MeshInstance3D] = []

func _ready() -> void:
  name = "v3-godot-authored-procedural-scene-runtime"
  Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
  _hide_legacy_blockouts()
  _tune_environment()
  _configure_camera()
  _build_ocean()
  _build_shoreline()
  _build_beach_house()
  _build_bar()
  _build_alhena()
  _build_black_lab()
  _build_fishing_rig()
  _build_detail_props()

func _hide_legacy_blockouts() -> void:
  for node in [legacy_water_plane, legacy_dog, legacy_alhena, legacy_bar, legacy_beach]:
    if node:
      node.visible = false

func _tune_environment() -> void:
  if world_environment and world_environment.environment:
    var env := world_environment.environment
    env.ambient_light_color = Color(0.56, 0.69, 0.72)
    env.ambient_light_energy = 0.52
    env.tonemap_exposure = 1.18
    env.fog_density = 0.0024
    env.fog_light_color = Color(0.72, 0.82, 0.80)
  if sun_light:
    sun_light.light_energy = 4.6

func _configure_camera() -> void:
  camera_rig.position = Vector3(-4.8, 2.25, 19.5)
  camera_rig.look_at(Vector3(3.6, 0.95, -5.0), Vector3.UP)
  camera.position = Vector3.ZERO
  camera.fov = 40.0

func _process(delta: float) -> void:
  var t: float = Time.get_ticks_msec() / 1000.0
  _animate_ocean(t)
  _animate_dog(t)
  _animate_alhena(t)
  _animate_fishing_line(t)
  if line_cast:
    bite_timer -= delta
    if bite_timer <= 0.0:
      line_cast = false

func _input(event: InputEvent) -> void:
  if event.is_action_pressed("cast"):
    line_cast = true
    bite_timer = 3.5
  if event.is_action_pressed("reel"):
    line_cast = false
  if event is InputEventMouseMotion and Input.is_action_pressed("orbit"):
    orbit_yaw -= event.relative.x * 0.003
    camera_rig.rotation.y = orbit_yaw

func _make_mat(name: String, color: Color, roughness := 0.75, metallic := 0.0, alpha := 1.0) -> StandardMaterial3D:
  var mat := StandardMaterial3D.new()
  mat.resource_name = name
  mat.albedo_color = Color(color.r, color.g, color.b, alpha)
  mat.roughness = roughness
  mat.metallic = metallic
  mat.specular_mode = BaseMaterial3D.SPECULAR_SCHLICK_GGX
  mat.cull_mode = BaseMaterial3D.CULL_DISABLED
  if alpha < 1.0:
    mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
    mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_ALWAYS
  return mat

func _box(name: String, size: Vector3, pos: Vector3, mat: Material, parent: Node = self) -> MeshInstance3D:
  var mesh := BoxMesh.new()
  mesh.size = size
  var node := MeshInstance3D.new()
  node.name = name
  node.mesh = mesh
  node.material_override = mat
  node.position = pos
  node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
  parent.add_child(node)
  return node

func _sphere(name: String, radius: float, pos: Vector3, mat: Material, parent: Node = self, scale := Vector3.ONE) -> MeshInstance3D:
  var mesh := SphereMesh.new()
  mesh.radius = radius
  mesh.height = radius * 2.0
  mesh.radial_segments = 32
  mesh.rings = 16
  var node := MeshInstance3D.new()
  node.name = name
  node.mesh = mesh
  node.material_override = mat
  node.position = pos
  node.scale = scale
  node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
  parent.add_child(node)
  return node

func _cylinder(name: String, radius: float, height: float, pos: Vector3, mat: Material, parent: Node = self, rotation := Vector3.ZERO) -> MeshInstance3D:
  var mesh := CylinderMesh.new()
  mesh.top_radius = radius
  mesh.bottom_radius = radius
  mesh.height = height
  mesh.radial_segments = 28
  var node := MeshInstance3D.new()
  node.name = name
  node.mesh = mesh
  node.material_override = mat
  node.position = pos
  node.rotation = rotation
  node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
  parent.add_child(node)
  return node

func _build_ocean() -> void:
  var mat := _make_mat("v3_spectral_ocean_translucent_fresnel_carrier", Color(0.025, 0.32, 0.38), 0.04, 0.0, 0.78)
  mat.emission_enabled = true
  mat.emission = Color(0.00, 0.12, 0.15)
  mat.emission_energy_multiplier = 0.35
  ocean_mesh = MeshInstance3D.new()
  ocean_mesh.name = "v3_jonswap_carrier_ocean_grid"
  ocean_mesh.mesh = _ocean_array_mesh(0.0)
  ocean_mesh.material_override = mat
  ocean_mesh.position = Vector3(0, -0.24, -54)
  ocean_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
  $OceanSlot.add_child(ocean_mesh)
  var foam_mat := _make_mat("v3_layered_shorebreak_foam_ribbons", Color(0.86, 0.98, 0.96), 0.35, 0.0, 0.36)
  for i in range(5):
    var ribbon := _box("v3_animated_foam_ribbon_%02d" % i, Vector3(44.0 - i * 3.8, 0.012, 0.07), Vector3(0, 0.02, -6.4 - i * 1.12), foam_mat, $OceanSlot)
    ribbon.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
    foam_ribbons.append(ribbon)

func _ocean_array_mesh(t: float) -> ArrayMesh:
  var verts := PackedVector3Array()
  var normals := PackedVector3Array()
  var uvs := PackedVector2Array()
  var indices := PackedInt32Array()
  for z in range(WATER_ROWS + 1):
    var vz: float = lerpf(0.0, -132.0, float(z) / float(WATER_ROWS))
    for x in range(WATER_COLS + 1):
      var vx: float = lerpf(-68.0, 68.0, float(x) / float(WATER_COLS))
      var h: float = _wave_height(vx, vz, t)
      verts.append(Vector3(vx, h, vz))
      normals.append(Vector3(0, 1, 0))
      uvs.append(Vector2(float(x) / float(WATER_COLS), float(z) / float(WATER_ROWS)))
  for z in range(WATER_ROWS):
    for x in range(WATER_COLS):
      var a := z * (WATER_COLS + 1) + x
      var b := a + 1
      var c := a + WATER_COLS + 1
      var d := c + 1
      indices.append_array([a, c, b, b, c, d])
  var arrays := []
  arrays.resize(Mesh.ARRAY_MAX)
  arrays[Mesh.ARRAY_VERTEX] = verts
  arrays[Mesh.ARRAY_NORMAL] = normals
  arrays[Mesh.ARRAY_TEX_UV] = uvs
  arrays[Mesh.ARRAY_INDEX] = indices
  var mesh := ArrayMesh.new()
  mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
  return mesh

func _wave_height(x: float, z: float, t: float) -> float:
  var h := 0.0
  var depth: float = clampf((-z - 2.0) / 130.0, 0.0, 1.0)
  h += sin(x * 0.085 + z * 0.060 + t * 0.75) * 0.22
  h += sin(x * 0.210 - z * 0.036 + t * 1.14) * 0.08
  h += sin(x * 0.520 + z * 0.120 + t * 1.90) * 0.025
  return h * lerpf(0.08, 1.0, depth)

func _animate_ocean(t: float) -> void:
  if ocean_mesh:
    ocean_mesh.mesh = _ocean_array_mesh(t)
  for i in range(foam_ribbons.size()):
    var ribbon := foam_ribbons[i]
    ribbon.position.x = sin(t * 0.55 + i * 1.7) * 0.55
    ribbon.position.z = -5.9 - i * 1.16 + sin(t * 0.72 + i) * 0.16
    ribbon.scale.x = 1.0 + sin(t * 0.4 + i * 1.9) * 0.045

func _build_shoreline() -> void:
  var sand := _make_mat("v3_stratified_pbr_sunlit_sand_with_micrograin", Color(0.88, 0.70, 0.42), 0.93)
  sand.emission_enabled = true
  sand.emission = Color(0.30, 0.20, 0.08)
  sand.emission_energy_multiplier = 0.18
  var wet := _make_mat("v3_wet_compacted_sand_reflective_band", Color(0.50, 0.39, 0.25), 0.34)
  var dune := _make_mat("v3_wind_cut_dune_material", Color(0.78, 0.58, 0.30), 0.98)
  var shore := MeshInstance3D.new()
  shore.name = "v3_sculpted_beach_mesh_replaces_flat_plane"
  shore.mesh = _shore_array_mesh()
  shore.material_override = sand
  $ShorelineEnvironmentSlot.add_child(shore)
  _box("v3_visible_foreground_sand_slab", Vector3(88, 0.22, 30), Vector3(0, -0.25, 12.0), sand, $ShorelineEnvironmentSlot)
  _box("v3_wet_sand_tidal_sheen_band", Vector3(86, 0.035, 3.2), Vector3(0, -0.03, -0.6), wet, $ShorelineEnvironmentSlot)
  _box("v3_bright_foam_line_separating_shore_and_ocean", Vector3(82, 0.025, 0.34), Vector3(0, 0.03, -3.25), _make_mat("v3_bright_shore_foam", Color(0.92, 0.98, 0.92), 0.32, 0.0, 0.62), $ShorelineEnvironmentSlot)
  for i in range(8):
    var grass_x: float = lerpf(-31.0, 29.0, float(i) / 7.0)
    _build_grass_clump(Vector3(grass_x, 0.05, 10.5 + sin(i) * 1.7), dune)

func _shore_array_mesh() -> ArrayMesh:
  var verts := PackedVector3Array()
  var normals := PackedVector3Array()
  var uvs := PackedVector2Array()
  var indices := PackedInt32Array()
  for z in range(SHORE_ROWS + 1):
    var vz: float = lerpf(-7.5, 26.0, float(z) / float(SHORE_ROWS))
    for x in range(SHORE_COLS + 1):
      var vx: float = lerpf(-44.0, 44.0, float(x) / float(SHORE_COLS))
      var ridge: float = sin(vx * 0.21) * 0.09 + sin(vx * 0.05 + vz * 0.24) * 0.16
      var rise: float = smoothstep(-3.0, 22.0, vz) * 1.15
      var wash: float = smoothstep(-3.2, 2.4, vz) * 0.18
      verts.append(Vector3(vx, -0.04 + ridge * smoothstep(3.0, 22.0, vz) + rise - wash, vz))
      normals.append(Vector3(0, 1, 0))
      uvs.append(Vector2(float(x) / float(SHORE_COLS), float(z) / float(SHORE_ROWS)))
  for z in range(SHORE_ROWS):
    for x in range(SHORE_COLS):
      var a := z * (SHORE_COLS + 1) + x
      var b := a + 1
      var c := a + SHORE_COLS + 1
      var d := c + 1
      indices.append_array([a, c, b, b, c, d])
  var arrays := []
  arrays.resize(Mesh.ARRAY_MAX)
  arrays[Mesh.ARRAY_VERTEX] = verts
  arrays[Mesh.ARRAY_NORMAL] = normals
  arrays[Mesh.ARRAY_TEX_UV] = uvs
  arrays[Mesh.ARRAY_INDEX] = indices
  var mesh := ArrayMesh.new()
  mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
  return mesh

func _build_grass_clump(pos: Vector3, mat: Material) -> void:
  var root := Node3D.new()
  root.name = "v3_instanced_sea_oats_grass_clump"
  root.position = pos
  $ShorelineEnvironmentSlot.add_child(root)
  for i in range(9):
    var blade := _box("blade_%02d" % i, Vector3(0.045, 0.95 + randf() * 0.45, 0.035), Vector3(sin(i) * 0.34, 0.45, cos(i * 1.7) * 0.22), mat, root)
    blade.rotation_degrees = Vector3(8 + i * 2, i * 31, -18 + i * 4)

func _build_beach_house() -> void:
  var wood := _make_mat("v3_weathered_cedar_house_wood", Color(0.48, 0.25, 0.11), 0.78)
  var roof := _make_mat("v3_dark_clay_roof", Color(0.36, 0.10, 0.055), 0.82)
  var warm := _make_mat("v3_warm_window_glass_emissive", Color(1.0, 0.66, 0.26), 0.18, 0.0, 0.86)
  warm.emission_enabled = true
  warm.emission = Color(1.0, 0.45, 0.16)
  warm.emission_energy_multiplier = 1.1
  var root := Node3D.new()
  root.name = "v3_modeled_beach_house_module"
  root.position = Vector3(-16.0, 1.02, 12.0)
  $ShorelineEnvironmentSlot.add_child(root)
  _box("house_body", Vector3(6.2, 2.2, 4.2), Vector3.ZERO, wood, root)
  var roof_a := _box("left_roof_slope", Vector3(6.9, 0.32, 4.8), Vector3(0, 1.35, 0), roof, root)
  roof_a.rotation_degrees.z = 10
  var roof_b := _box("right_roof_slope", Vector3(6.9, 0.32, 4.8), Vector3(0, 1.35, 0), roof, root)
  roof_b.rotation_degrees.z = -10
  _box("lit_window", Vector3(1.0, 0.9, 0.08), Vector3(-1.4, -0.05, -2.13), warm, root)
  _box("front_door", Vector3(0.9, 1.6, 0.09), Vector3(1.25, -0.28, -2.14), _make_mat("v3_dark_house_door", Color(0.17,0.08,0.035), .68), root)

func _build_bar() -> void:
  var wood := _make_mat("v3_beach_bar_layered_wood", Color(0.28, 0.13, 0.055), 0.72)
  var bamboo := _make_mat("v3_bamboo_trim", Color(0.75, 0.57, 0.28), 0.80)
  var root := Node3D.new()
  root.name = "v3_modular_beach_bar_with_counter_and_shelves"
  root.position = Vector3(11.5, 1.03, 9.2)
  $BeachBarSlot.add_child(root)
  _box("front_planked_counter", Vector3(5.7, 1.15, 0.56), Vector3(0, 0.05, 0), wood, root)
  _box("stone_top", Vector3(6.1, 0.16, 0.86), Vector3(0, 0.72, -0.03), bamboo, root)
  _box("back_shelf", Vector3(4.9, 0.12, 0.28), Vector3(0, 1.35, 0.42), bamboo, root)
  for i in range(6):
    var x := -2.25 + i * 0.9
    _cylinder("bottle_%02d" % i, 0.09, 0.55 + (i % 3) * 0.12, Vector3(x, 1.68, 0.42), _make_mat("v3_translucent_bar_glass_%02d" % i, Color(0.12 + i * .04, 0.55, 0.48 + i * .03), .18, 0.0, .74), root)

func _build_alhena() -> void:
  alhena_root = Node3D.new()
  alhena_root.name = "v3_alhena_articulated_bartender_standin"
  alhena_root.position = Vector3(11.9, 1.68, 8.2)
  $AlhenaSlot.add_child(alhena_root)
  var skin := _make_mat("v3_alhena_skin_material", Color(0.50, 0.30, 0.20), 0.62)
  var dress := _make_mat("v3_alhena_teal_bartender_dress", Color(0.05, 0.62, 0.72), 0.74)
  var hair := _make_mat("v3_alhena_dark_braided_hair", Color(0.045, 0.025, 0.018), 0.66)
  _sphere("head", 0.28, Vector3(0, 1.36, 0), skin, alhena_root, Vector3(0.86, 1.08, 0.82))
  _sphere("hair_cap", 0.30, Vector3(0, 1.44, -0.03), hair, alhena_root, Vector3(0.95, 0.62, 0.86))
  _box("torso_dress", Vector3(0.58, 0.92, 0.28), Vector3(0, 0.70, 0), dress, alhena_root)
  alhena_arm_l = Node3D.new()
  alhena_arm_l.name = "left_arm_serve_pose"
  alhena_arm_l.position = Vector3(-0.36, 1.02, 0)
  alhena_root.add_child(alhena_arm_l)
  _cylinder("upper_lower_arm", 0.045, 0.72, Vector3(0, -0.30, 0), skin, alhena_arm_l, Vector3(0, 0, 0.25))
  alhena_arm_r = Node3D.new()
  alhena_arm_r.name = "right_arm_wave_pose"
  alhena_arm_r.position = Vector3(0.36, 1.02, 0)
  alhena_root.add_child(alhena_arm_r)
  _cylinder("upper_lower_arm", 0.045, 0.72, Vector3(0, -0.30, 0), skin, alhena_arm_r, Vector3(0, 0, -0.25))
  _cylinder("left_leg", 0.055, 0.62, Vector3(-0.14, 0.05, 0), skin, alhena_root)
  _cylinder("right_leg", 0.055, 0.62, Vector3(0.14, 0.05, 0), skin, alhena_root)

func _build_black_lab() -> void:
  dog_root = Node3D.new()
  dog_root.name = "v3_black_lab_articulated_bone_proxy"
  dog_root.position = Vector3(-3.5, 0.72, 11.2)
  dog_root.scale = Vector3(0.64, 0.64, 0.64)
  $BlackLabSlot.add_child(dog_root)
  var fur := _make_mat("v3_black_lab_fur_with_rim_response", Color(0.015, 0.012, 0.010), 0.48)
  var nose := _make_mat("v3_wet_lab_nose_and_eyes", Color(0.0, 0.0, 0.0), 0.22)
  _sphere("ribcage", 0.48, Vector3(0, 0.38, 0), fur, dog_root, Vector3(1.72, 0.82, 0.74))
  _sphere("hips", 0.38, Vector3(-0.76, 0.34, 0.05), fur, dog_root, Vector3(1.2, 0.70, 0.70))
  dog_head = Node3D.new()
  dog_head.name = "head_bone"
  dog_head.position = Vector3(0.84, 0.55, 0.02)
  dog_root.add_child(dog_head)
  _sphere("skull", 0.29, Vector3.ZERO, fur, dog_head, Vector3(1.08, 0.88, 0.82))
  _sphere("muzzle", 0.16, Vector3(0.27, -0.03, 0.0), fur, dog_head, Vector3(1.35, 0.70, 0.62))
  _sphere("nose", 0.055, Vector3(0.45, 0.0, 0.0), nose, dog_head)
  _sphere("left_ear", 0.105, Vector3(-0.02, -0.03, -0.24), fur, dog_head, Vector3(0.55, 1.3, 0.42))
  _sphere("right_ear", 0.105, Vector3(-0.02, -0.03, 0.24), fur, dog_head, Vector3(0.55, 1.3, 0.42))
  for i in range(4):
    var leg := Node3D.new()
    leg.name = "leg_bone_%02d" % i
    leg.position = Vector3(0.38 if i < 2 else -0.55, 0.08, -0.28 if i % 2 == 0 else 0.28)
    dog_root.add_child(leg)
    _cylinder("leg_segment", 0.065, 0.54, Vector3(0, -0.20, 0), fur, leg)
    dog_legs.append(leg)
  dog_tail = Node3D.new()
  dog_tail.name = "tail_bone_wag"
  dog_tail.position = Vector3(-1.18, 0.47, 0.02)
  dog_root.add_child(dog_tail)
  _cylinder("tail_mesh", 0.055, 0.88, Vector3(-0.34, 0.03, 0), fur, dog_tail, Vector3(0, 0, 1.42))

func _build_fishing_rig() -> void:
  var rod_mat := _make_mat("v3_fishing_rod_graphite", Color(0.035, 0.030, 0.025), 0.36)
  var line_mat := _make_mat("v3_taut_monofilament_line", Color(0.88, 0.96, 1.0), 0.20, 0.0, 0.42)
  var bobber_mat := _make_mat("v3_red_white_bobber", Color(0.96, 0.12, 0.08), 0.38)
  _cylinder("v3_angled_fishing_rod", 0.035, 6.7, Vector3(13.9, 1.55, 11.0), rod_mat, self, Vector3(1.05, 0, -0.42))
  bobber = _sphere("v3_wave_buoyant_bobber", 0.16, Vector3(0.2, -0.02, -24.0), bobber_mat, self, Vector3(1.0, 1.0, 1.0))
  line_mesh = _box("v3_visible_cast_line_proxy", Vector3(0.025, 0.025, 25.0), Vector3(6.6, 0.82, -5.8), line_mat, self)
  line_mesh.rotation_degrees = Vector3(-18, 18, 0)

func _build_detail_props() -> void:
  var shell := _make_mat("v3_shells_pebbles_microprops", Color(0.85, 0.78, 0.62), 0.88)
  var drift := _make_mat("v3_driftwood_weathered", Color(0.33, 0.24, 0.16), 0.96)
  for i in range(30):
    var x: float = lerpf(-22.0, 24.0, randf())
    var z: float = lerpf(2.0, 18.0, randf())
    _sphere("v3_beach_shell_pebble_%02d" % i, 0.045 + randf() * 0.055, Vector3(x, 0.07 + z * 0.02, z), shell, $ShorelineEnvironmentSlot, Vector3(1.0 + randf(), 0.28, 0.72 + randf()))
  _cylinder("v3_bleached_driftwood_log", 0.13, 3.2, Vector3(-5.8, 0.38, 8.4), drift, $ShorelineEnvironmentSlot, Vector3(1.35, 0, 1.18))
  var sun_mat := _make_mat("v3_visible_low_sun_emissive_orb", Color(1.0, 0.72, 0.30), 0.12)
  sun_mat.emission_enabled = true
  sun_mat.emission = Color(1.0, 0.48, 0.16)
  sun_mat.emission_energy_multiplier = 2.4
  _sphere("v3_visible_low_sun_orb", 1.1, Vector3(-18.0, 9.5, -62.0), sun_mat, self, Vector3(1.0, 1.0, 0.08))

func _animate_dog(t: float) -> void:
  if !dog_root:
    return
  var walk_phase := t * 1.15
  dog_root.position.x = -3.2 + sin(walk_phase * 0.42) * DOG_WALK_RADIUS
  dog_root.position.z = 11.2 + cos(walk_phase * 0.37) * 0.62
  dog_root.rotation.y = sin(walk_phase * 0.42) * 0.16
  dog_head.rotation.y = sin(t * 1.4) * 0.18
  dog_tail.rotation.y = sin(t * 5.8) * 0.42
  for i in range(dog_legs.size()):
    dog_legs[i].rotation.z = sin(t * 4.0 + i * PI) * 0.18

func _animate_alhena(t: float) -> void:
  if !alhena_root:
    return
  alhena_root.position.y = 1.68 + sin(t * 0.86) * 0.025
  alhena_arm_l.rotation.z = 0.28 + sin(t * 0.7) * 0.055
  alhena_arm_r.rotation.z = -0.38 + sin(t * 1.1) * 0.075

func _animate_fishing_line(t: float) -> void:
  if bobber:
    bobber.position.y = -0.02 + _wave_height(bobber.position.x, bobber.position.z, t) + sin(t * 2.1) * 0.035
    if line_cast:
      bobber.position.z = lerpf(bobber.position.z, -34.0, 0.035)
    else:
      bobber.position.z = lerpf(bobber.position.z, -21.0, 0.028)
  if line_mesh:
    line_mesh.rotation_degrees.x = -12.0 + sin(t * 1.8) * 2.2
