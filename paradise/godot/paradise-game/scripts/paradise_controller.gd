extends Node3D

@onready var camera_rig: Node3D = $CameraRig
@onready var water_plane: MeshInstance3D = $OceanSlot/WaterPlane
@onready var dog: MeshInstance3D = $BlackLabSlot/DogBlockout
@onready var alhena: MeshInstance3D = $AlhenaSlot/AlhenaBlockout

var orbit_yaw := 0.0
var line_cast := false
var bite_timer := 0.0

func _ready() -> void:
  name = "v3-godot-glb-production-gate-runtime"
  Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)

func _process(delta: float) -> void:
  var t := Time.get_ticks_msec() / 1000.0
  water_plane.position.y = -0.12 + sin(t * 0.62) * 0.018
  dog.position.x = 1.4 + sin(t * 0.34) * 0.22
  dog.position.z = 5.6 + cos(t * 0.29) * 0.10
  alhena.position.y = 0.7 + sin(t * 0.86) * 0.018
  if line_cast:
    bite_timer -= delta
    if bite_timer <= 0.0:
      line_cast = false

func _input(event: InputEvent) -> void:
  if event.is_action_pressed("cast"):
    line_cast = true
    bite_timer = 3.5
  if event is InputEventMouseMotion and Input.is_action_pressed("orbit"):
    orbit_yaw -= event.relative.x * 0.003
    camera_rig.rotation.y = orbit_yaw
