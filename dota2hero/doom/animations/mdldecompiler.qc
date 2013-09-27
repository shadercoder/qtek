$cd "C:\Users\lang\Desktop\doom"
$modelname "heroes/doom/doom.mdl"
$model "default" "doom_model.dmx.smd"

$lod 1
 {
  replacemodel "doom_model.dmx" "lod1_doom_model.dmx"
}
$poseparameter TURN -1.00 1.00
$cdmaterials ""
$hboxset "default"
$hbox 0 "l_thigh9_0" -7.961  -16.810  0.289  22.259  2.702  72.023
$hbox 0 "knee_R" -55.597  -13.375  -13.212  2.233  16.608  34.070
$hbox 0 "thigh_R" -69.514  -18.557  -19.013  2.360  18.196  19.272
$hbox 0 "tail6_3" 8.033  -4.773  -3.967  30.309  4.773  4.846
$hbox 0 "tail6_2" -0.601  -4.590  -3.399  36.065  4.698  9.161
$hbox 0 "tail6_1" 13.127  -5.726  -2.750  32.220  5.726  11.576
$hbox 0 "tail6_0" -6.139  -12.893  -7.776  45.734  12.893  19.621
$hbox 0 "r_wing_bottom5_0" -65.077  -4.144  -6.705  7.351  9.644  19.153
$hbox 0 "r_wing_top4_0" -57.380  -26.803  -37.497  59.386  36.334  52.456
$hbox 0 "r_wing3_1" -111.479  -9.779  -15.860  12.283  16.906  21.246
$hbox 0 "r_wing3_0" -48.580  -45.847  -8.669  93.555  5.046  55.462
$hbox 0 "elbow_R" -31.961  -18.916  -13.966  14.041  17.814  23.374
$hbox 0 "bicep_R" -20.498  -11.505  -16.020  7.352  13.638  23.804
$hbox 0 "elbow_L" -13.827  -15.319  -19.345  33.794  12.280  14.075
$hbox 0 "bicep_L" 1.325  -16.428  -16.306  27.248  10.979  14.963
$hbox 0 "Spine_3" -51.305  -42.186  -44.057  22.276  51.884  25.955
$hbox 0 "l_wing0_1" -111.439  -20.084  -30.743  84.631  9.997  21.327
$hbox 0 "l_wing_top1_0" -61.745  -37.426  -37.433  59.504  19.500  40.470
$hbox 0 "l_wing_bottom2_0" -65.076  -9.781  -6.609  7.352  4.006  19.249
$hbox 0 "l_wing0_0" -48.687  -3.248  -7.685  93.449  47.645  55.461
$hbox 0 "medalions7_0" -23.588  -14.870  -5.106  11.039  23.617  10.925
$hbox 0 "Spine_1" -18.050  -34.982  -35.271  30.368  36.541  23.574
$hbox 0 "Spine_1" -18.050  -34.982  -35.271  30.368  36.541  23.574
$hbox 0 "knee_L" -6.234  -16.608  -34.070  55.628  13.375  16.228
$hbox 0 "r_thigh8_0" -8.123  -2.771  0.170  22.097  16.741  71.904
$hbox 0 "thigh_L" -2.360  -18.196  -19.131  69.514  18.557  19.013
$hbox 0 "Root_0" -36.617  -29.220  -30.117  31.088  29.220  19.997
$hboxset "feet"
$hbox 0 "ankle_R" -40.612  -13.539  -17.718  15.721  12.570  9.113
$hbox 0 "ankle_L" -15.703  -12.570  -9.113  40.612  13.539  17.718
$hboxset "weapon"
$hbox 0 "sword_1" -3.327  -14.975  17.806  3.804  12.922  157.074
$hboxset "hands"
$hbox 0 "wrist_R" -28.480  -22.179  -16.666  3.127  6.863  12.701
$hbox 0 "wrist_L" -3.274  -3.980  -12.929  38.600  23.002  21.178
$hboxset "head"
$hbox 0 "Head_1" -14.420  -26.780  -16.595  45.553  26.780  65.716
$hboxset "select_high"
$hbox 0 "Spine_1" -22.036  -36.112  -36.385  79.151  37.671  24.319
$hbox 0 "Root_0" -40.224  -40.190  -114.808  34.695  40.190  41.956
$hboxset "select_low"
$hbox 0 "Root_0" -93.807  -101.291  -128.269  88.278  101.291  145.303
$attachment "attach_attack1" "sword_1" 0.00 0.00 0.00 rotate -0.00 0.00 0.00
$attachment "attach_weapon_blur" "sword_1" 0.00 0.00 72.00 rotate -0.00 0.00 0.00
$attachment "attach_mouth" "Head_0" 14.00 -0.00 -14.00 rotate 30.00 -0.00 0.00
$attachment "attach_hitloc" "Spine_1" 24.00 -0.00 -24.00 rotate -0.00 -0.00 0.00
$surfaceprop "default"
$keyvalues  {  } 
$illumposition 12.197 0.000 157.385
$sequence BindPose "BindPose" fps 30.00
$sequence idle "idle" loop ACT_DOTA_IDLE 8 fps 30.00
$sequence idle2 "idle2" loop ACT_DOTA_IDLE_RARE 1 fps 30.00
$sequence attack1 "attack1" ACT_DOTA_ATTACK 3 fps 30.00
$sequence attack2 "attack2" ACT_DOTA_ATTACK 1 fps 30.00
$sequence run "run" loop ACT_DOTA_RUN 1 fps 30.00 {
  { event AE_CL_PLAYSOUND 1 "Hero_DoomBringer.Footsteps" }
  { event AE_CL_PLAYSOUND 12 "Hero_DoomBringer.Footsteps" }
}

$sequence cast_devour "cast_devour" ACT_DOTA_CAST_ABILITY_1 1 fps 30.00
$sequence stomp "stomp" ACT_DOTA_CAST_ABILITY_2 1 fps 30.00
$sequence cast_level_death "cast_level_death" ACT_DOTA_CAST_ABILITY_3 1 fps 30.00
$sequence cast_doom "cast_doom" ACT_DOTA_CAST_ABILITY_6 1 fps 30.00
$sequence stun "stun" loop ACT_DOTA_DISABLED 1 fps 30.00
$sequence death "death" ACT_DOTA_DIE 1 fps 30.00 {
  { event AE_CL_PLAYSOUND 19 "BodyImpact_Common.Giant" }
}

$sequence portrait "portrait" loop ACT_DOTA_CAPTURE 1 fps 30.00
$sequence flail "flail" loop ACT_DOTA_FLAIL 1 fps 30.00
$sequence cast_generic_4 "cast_generic_4" ACT_DOTA_CAST_ABILITY_4 1 fps 30.00
$sequence cast_generic_5 "cast_generic_5" ACT_DOTA_CAST_ABILITY_5 1 fps 30.00
$sequence spell_channeling_1 "spell_channeling_1" loop ACT_DOTA_CHANNEL_ABILITY_4 1 fps 30.00
$sequence spell_channeling_2 "spell_channeling_2" loop ACT_DOTA_CHANNEL_ABILITY_5 1 fps 30.00
$sequence run_chase "run_chase" loop ACT_DOTA_RUN 1 fps 30.00 {
  { event AE_CL_PLAYSOUND 1 "Hero_DoomBringer.Footsteps" }
  { event AE_CL_PLAYSOUND 12 "Hero_DoomBringer.Footsteps" }
}

$sequence run_injured "run_injured" loop ACT_DOTA_RUN 1 fps 30.00 {
  { event AE_CL_PLAYSOUND 1 "Hero_DoomBringer.Footsteps" }
  { event AE_CL_PLAYSOUND 12 "Hero_DoomBringer.Footsteps" }
}

$sequence attack1_injured "attack1_injured" ACT_DOTA_ATTACK 1 fps 30.00
$sequence attack2_injured "attack2_injured" ACT_DOTA_ATTACK 1 fps 30.00
$sequence idle_injured "idle_injured" loop ACT_DOTA_IDLE 1 fps 30.00
$sequence teleport "teleport" loop ACT_DOTA_TELEPORT 1 fps 20.00
$sequence teleport_end "teleport_end" ACT_DOTA_TELEPORT_END 1 fps 30.00
$sequence victory "victory" loop ACT_DOTA_VICTORY 1 fps 30.00
$sequence spawn "spawn" ACT_DOTA_SPAWN 1 fps 30.00
$sequence workshop_anim_00 "workshop_anim_00" fps 30.00
$sequence workshop_anim_01 "workshop_anim_01" fps 30.00
$sequence workshop_anim_02 "workshop_anim_02" fps 30.00
$sequence workshop_anim_03 "workshop_anim_03" fps 30.00
$sequence workshop_anim_04 "workshop_anim_04" fps 30.00
$sequence workshop_anim_05 "workshop_anim_05" fps 30.00
$sequence workshop_anim_06 "workshop_anim_06" fps 30.00
$sequence workshop_anim_07 "workshop_anim_07" fps 30.00
$sequence workshop_anim_08 "workshop_anim_08" fps 30.00
$sequence workshop_anim_09 "workshop_anim_09" fps 30.00
$sequence loadout_eyeoffetizu "loadout_eyeoffetizu" loop ACT_DOTA_LOADOUT 1 fps 30.00
$sequence attack_eyeoffetizu "attack_eyeoffetizu" ACT_DOTA_ATTACK 2 fps 30.00
$sequence attack_eyeoffetizu2 "attack_eyeoffetizu2" ACT_DOTA_ATTACK 3 fps 30.00
$sequence attack_eyeoffetizu3 "attack_eyeoffetizu3" ACT_DOTA_ATTACK 1 fps 30.00
$sequence loadout "loadout" loop ACT_DOTA_LOADOUT 1 fps 30.00
$sequence attack1_pyre "attack1_pyre" ACT_DOTA_ATTACK 1 fps 30.00
$sequence attack2_pyre "attack2_pyre" ACT_DOTA_ATTACK 3 fps 30.00
$sequence turns_lookFrame_0 "turns_lookFrame_0" fps 30.00
$sequence turns_lookFrame_1 "turns_lookFrame_1" fps 30.00
$sequence turns_lookFrame_2 "turns_lookFrame_2" fps 30.00
$sequence turns "turns_lookFrame_0" fps 30.00 {
  blendwidth 3
  blend TURN -1.000000 1.000000
  delta
 turns_lookFrame_0 turns_lookFrame_1 turns_lookFrame_2
}
