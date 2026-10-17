{
    "patcher": {
        "fileversion": 1,
        "appversion": {
            "major": 9,
            "minor": 1,
            "revision": 5,
            "architecture": "x64",
            "modernui": 1
        },
        "classnamespace": "box",
        "rect": [ 100.0, 95.0, 800.0, 754.0 ],
        "openinpresentation": 1,
        "devicewidth": 320.0,
        "boxes": [
            {
                "box": {
                    "id": "obj-1",
                    "maxclass": "newobj",
                    "numinlets": 1,
                    "numoutlets": 1,
                    "outlettype": [ "bang" ],
                    "patching_rect": [ 24.0, 24.0, 100.0, 22.0 ],
                    "text": "loadbang",
                    "varname": "loadbang"
                }
            },
            {
                "box": {
                    "id": "obj-3",
                    "maxclass": "message",
                    "numinlets": 2,
                    "numoutlets": 1,
                    "outlettype": [ "" ],
                    "patching_rect": [ 204.0, 24.0, 106.0, 22.0 ],
                    "text": "\"Fixture message\"",
                    "varname": "message"
                }
            },
            {
                "box": {
                    "id": "obj-5",
                    "maxclass": "comment",
                    "numinlets": 1,
                    "numoutlets": 0,
                    "patching_rect": [ 384.0, 24.0, 150.0, 20.0 ],
                    "text": "Fixture comment",
                    "varname": "comment"
                }
            },
            {
                "box": {
                    "id": "obj-7",
                    "maxclass": "button",
                    "numinlets": 1,
                    "numoutlets": 1,
                    "outlettype": [ "bang" ],
                    "parameter_enable": 0,
                    "patching_rect": [ 564.0, 24.0, 24.0, 24.0 ],
                    "varname": "button"
                }
            },
            {
                "box": {
                    "id": "obj-9",
                    "maxclass": "toggle",
                    "numinlets": 1,
                    "numoutlets": 1,
                    "outlettype": [ "int" ],
                    "parameter_enable": 0,
                    "patching_rect": [ 24.0, 124.0, 24.0, 24.0 ],
                    "varname": "toggle"
                }
            },
            {
                "box": {
                    "id": "obj-11",
                    "maxclass": "number",
                    "numinlets": 1,
                    "numoutlets": 2,
                    "outlettype": [ "", "bang" ],
                    "parameter_enable": 0,
                    "patching_rect": [ 204.0, 124.0, 50.0, 22.0 ],
                    "varname": "number"
                }
            },
            {
                "box": {
                    "format": 6,
                    "id": "obj-13",
                    "maxclass": "flonum",
                    "numinlets": 1,
                    "numoutlets": 2,
                    "outlettype": [ "", "bang" ],
                    "parameter_enable": 0,
                    "patching_rect": [ 384.0, 124.0, 50.0, 22.0 ],
                    "varname": "flonum"
                }
            },
            {
                "box": {
                    "id": "obj-14",
                    "maxclass": "newobj",
                    "numinlets": 2,
                    "numoutlets": 2,
                    "outlettype": [ "signal", "signal" ],
                    "patching_rect": [ 564.0, 124.0, 100.0, 22.0 ],
                    "text": "plugin~",
                    "varname": "plugin~"
                }
            },
            {
                "box": {
                    "id": "obj-15",
                    "maxclass": "newobj",
                    "numinlets": 2,
                    "numoutlets": 2,
                    "outlettype": [ "signal", "signal" ],
                    "patching_rect": [ 24.0, 224.0, 100.0, 22.0 ],
                    "text": "plugout~",
                    "varname": "plugout~"
                }
            },
            {
                "box": {
                    "id": "obj-16",
                    "maxclass": "newobj",
                    "numinlets": 1,
                    "numoutlets": 1,
                    "outlettype": [ "int" ],
                    "patching_rect": [ 204.0, 224.0, 100.0, 22.0 ],
                    "text": "midiin",
                    "varname": "midiin"
                }
            },
            {
                "box": {
                    "id": "obj-17",
                    "maxclass": "newobj",
                    "numinlets": 1,
                    "numoutlets": 0,
                    "patching_rect": [ 384.0, 224.0, 100.0, 22.0 ],
                    "text": "midiout",
                    "varname": "midiout"
                }
            },
            {
                "box": {
                    "id": "obj-19",
                    "maxclass": "live.dial",
                    "numinlets": 1,
                    "numoutlets": 2,
                    "outlettype": [ "", "float" ],
                    "parameter_enable": 1,
                    "patching_rect": [ 564.0, 224.0, 41.0, 48.0 ],
                    "presentation": 1,
                    "presentation_rect": [ 16.0, 48.0, 60.0, 48.0 ],
                    "saved_attribute_attributes": {
                        "valueof": {
                            "parameter_longname": "live.dial",
                            "parameter_modmode": 3,
                            "parameter_shortname": "live.dial",
                            "parameter_type": 0,
                            "parameter_unitstyle": 0
                        }
                    },
                    "varname": "dial_vertical"
                }
            },
            {
                "box": {
                    "appearance": 2,
                    "id": "obj-21",
                    "maxclass": "live.dial",
                    "numinlets": 1,
                    "numoutlets": 2,
                    "outlettype": [ "", "float" ],
                    "parameter_enable": 1,
                    "patching_rect": [ 24.0, 324.0, 41.0, 80.0 ],
                    "presentation": 1,
                    "presentation_rect": [ 96.0, 48.0, 72.0, 80.0 ],
                    "saved_attribute_attributes": {
                        "valueof": {
                            "parameter_longname": "live.dial[1]",
                            "parameter_modmode": 3,
                            "parameter_shortname": "live.dial[1]",
                            "parameter_type": 0,
                            "parameter_unitstyle": 0
                        }
                    },
                    "varname": "dial_panel"
                }
            },
            {
                "box": {
                    "appearance": 3,
                    "id": "obj-23",
                    "maxclass": "live.dial",
                    "numinlets": 1,
                    "numoutlets": 2,
                    "outlettype": [ "", "float" ],
                    "parameter_enable": 1,
                    "patching_rect": [ 204.0, 324.0, 50.0, 63.0 ],
                    "presentation": 1,
                    "presentation_rect": [ 192.0, 48.0, 80.0, 63.0 ],
                    "saved_attribute_attributes": {
                        "valueof": {
                            "parameter_longname": "live.dial[2]",
                            "parameter_modmode": 3,
                            "parameter_shortname": "live.dial[2]",
                            "parameter_type": 0,
                            "parameter_unitstyle": 0
                        }
                    },
                    "varname": "dial_large"
                }
            },
            {
                "box": {
                    "fontsize": 10.0,
                    "id": "obj-25",
                    "maxclass": "live.comment",
                    "numinlets": 1,
                    "numoutlets": 0,
                    "patching_rect": [ 384.0, 324.0, 150.0, 18.0 ],
                    "presentation": 1,
                    "presentation_rect": [ 8.0, 8.0, 288.0, 18.0 ],
                    "text": "NATIVE FIXTURE",
                    "textjustification": 0,
                    "varname": "header"
                }
            },
            {
                "box": {
                    "angle": 270.0,
                    "background": 1,
                    "bgcolor": [ 0.08235294117647059, 0.08235294117647059, 0.08235294117647059, 1.0 ],
                    "id": "obj-27",
                    "maxclass": "panel",
                    "mode": 0,
                    "numinlets": 1,
                    "numoutlets": 0,
                    "patching_rect": [ 564.0, 324.0, 128.0, 128.0 ],
                    "presentation": 1,
                    "presentation_rect": [ 8.0, 32.0, 288.0, 4.0 ],
                    "proportion": 0.39,
                    "rounded": 0,
                    "saved_attribute_attributes": {
                        "bgfillcolor": {
                            "expression": "themecolor.live_contrast_frame"
                        }
                    },
                    "varname": "separator"
                }
            },
            {
                "box": {
                    "id": "obj-29",
                    "maxclass": "comment",
                    "numinlets": 1,
                    "numoutlets": 0,
                    "patching_rect": [ 24.0, 424.0, 261.0, 20.0 ],
                    "text": "Created by typed Patcher/Maxobj API; Max 915",
                    "varname": "provenance"
                }
            }
        ],
        "lines": [
            {
                "patchline": {
                    "destination": [ "obj-15", 1 ],
                    "source": [ "obj-14", 1 ]
                }
            },
            {
                "patchline": {
                    "destination": [ "obj-15", 0 ],
                    "source": [ "obj-14", 0 ]
                }
            },
            {
                "patchline": {
                    "destination": [ "obj-17", 0 ],
                    "source": [ "obj-16", 0 ]
                }
            }
        ],
        "oscreceiveudpport": 0
    }
}