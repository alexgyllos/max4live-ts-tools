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
        "rect": [ 84.0, 139.0, 600.0, 360.0 ],
        "openrect": [ 0.0, 0.0, 320.0, 169.0 ],
        "openrectmode": 0,
        "openinpresentation": 1,
        "devicewidth": 320.0,
        "boxes": [
            {
                "box": {
                    "fontsize": 10.0,
                    "id": "obj-5",
                    "maxclass": "live.comment",
                    "numinlets": 1,
                    "numoutlets": 0,
                    "patching_rect": [ 1271.0, -69.0, 150.0, 18.0 ],
                    "presentation": 1,
                    "presentation_rect": [ 16.0, 8.0, 76.0, 18.0 ],
                    "text": "AUDIO EFFECT",
                    "textjustification": 0
                }
            },
            {
                "box": {
                    "appearance": 3,
                    "id": "obj-3",
                    "maxclass": "live.dial",
                    "numinlets": 1,
                    "numoutlets": 2,
                    "outlettype": [ "", "float" ],
                    "parameter_enable": 1,
                    "patching_rect": [ 540.0, -83.0, 50.0, 63.0 ],
                    "presentation": 1,
                    "presentation_rect": [ 192.0, 40.0, 72.0, 63.0 ],
                    "saved_attribute_attributes": {
                        "valueof": {
                            "parameter_longname": "live.dial[2]",
                            "parameter_modmode": 3,
                            "parameter_shortname": "live.dial[2]",
                            "parameter_type": 0,
                            "parameter_unitstyle": 0
                        }
                    },
                    "varname": "live.dial[2]"
                }
            },
            {
                "box": {
                    "appearance": 2,
                    "id": "obj-2",
                    "maxclass": "live.dial",
                    "numinlets": 1,
                    "numoutlets": 2,
                    "outlettype": [ "", "float" ],
                    "parameter_enable": 1,
                    "patching_rect": [ 710.0, 814.0, 41.0, 80.0 ],
                    "presentation": 1,
                    "presentation_rect": [ 104.0, 40.0, 72.0, 80.0 ],
                    "saved_attribute_attributes": {
                        "valueof": {
                            "parameter_longname": "live.dial[1]",
                            "parameter_modmode": 3,
                            "parameter_shortname": "live.dial[1]",
                            "parameter_type": 0,
                            "parameter_unitstyle": 0
                        }
                    },
                    "varname": "live.dial[1]"
                }
            },
            {
                "box": {
                    "id": "obj-1",
                    "maxclass": "live.dial",
                    "numinlets": 1,
                    "numoutlets": 2,
                    "outlettype": [ "", "float" ],
                    "parameter_enable": 1,
                    "patching_rect": [ 555.0, 190.0, 41.0, 48.0 ],
                    "presentation": 1,
                    "presentation_rect": [ 555.0, 190.0, 41.0, 48.0 ],
                    "saved_attribute_attributes": {
                        "valueof": {
                            "parameter_longname": "live.dial",
                            "parameter_modmode": 3,
                            "parameter_shortname": "live.dial",
                            "parameter_type": 0,
                            "parameter_unitstyle": 0
                        }
                    },
                    "varname": "live.dial"
                }
            },
            {
                "box": {
                    "id": "input",
                    "maxclass": "newobj",
                    "numinlets": 2,
                    "numoutlets": 2,
                    "outlettype": [ "signal", "signal" ],
                    "patching_rect": [ 20.0, 30.0, 80.0, 22.0 ],
                    "text": "plugin~"
                }
            },
            {
                "box": {
                    "id": "output",
                    "maxclass": "newobj",
                    "numinlets": 2,
                    "numoutlets": 2,
                    "outlettype": [ "signal", "signal" ],
                    "patching_rect": [ 20.0, 240.0, 80.0, 22.0 ],
                    "text": "plugout~"
                }
            },
            {
                "box": {
                    "angle": 270.0,
                    "annotation": "max4live-ts-tools/native/v1/separator",
                    "background": 1,
                    "bgcolor": [ 0.08235294117647059, 0.08235294117647059, 0.08235294117647059, 1.0 ],
                    "id": "obj-6",
                    "maxclass": "panel",
                    "mode": 0,
                    "numinlets": 1,
                    "numoutlets": 0,
                    "patching_rect": [ 118.0, 356.0, 128.0, 128.0 ],
                    "presentation": 1,
                    "presentation_rect": [ 8.0, 32.0, 272.0, 4.0 ],
                    "proportion": 0.39,
                    "rounded": 0,
                    "saved_attribute_attributes": {
                        "bgfillcolor": {
                            "expression": "themecolor.live_contrast_frame"
                        }
                    }
                }
            },
            {
                "box": {
                    "angle": 270.0,
                    "background": 1,
                    "bgcolor": [ 0.11764705882352941, 0.11764705882352941, 0.11764705882352941, 1.0 ],
                    "id": "obj-4",
                    "maxclass": "panel",
                    "mode": 0,
                    "numinlets": 1,
                    "numoutlets": 0,
                    "patching_rect": [ 1182.0, 459.0, 128.0, 128.0 ],
                    "presentation": 1,
                    "presentation_rect": [ 8.0, 8.0, 272.0, 144.0 ],
                    "proportion": 0.39,
                    "rounded": 0,
                    "saved_attribute_attributes": {
                        "bgfillcolor": {
                            "expression": "themecolor.live_lcd_bg"
                        }
                    }
                }
            }
        ],
        "lines": [
            {
                "patchline": {
                    "destination": [ "output", 1 ],
                    "source": [ "input", 1 ]
                }
            },
            {
                "patchline": {
                    "destination": [ "output", 0 ],
                    "source": [ "input", 0 ]
                }
            }
        ],
        "parameters": {
            "obj-1": [ "live.dial", "live.dial", 0 ],
            "obj-2": [ "live.dial[1]", "live.dial[1]", 0 ],
            "obj-3": [ "live.dial[2]", "live.dial[2]", 0 ],
            "parameterbanks": {
                "0": {
                    "index": 0,
                    "name": "",
                    "parameters": [ "-", "-", "-", "-", "-", "-", "-", "-" ],
                    "buttons": [ "-", "-", "-", "-", "-", "-", "-", "-" ]
                }
            },
            "inherited_shortname": 1
        },
        "latency": 0,
        "is_mpe": 0,
        "external_mpe_tuning_enabled": 0,
        "minimum_live_version": "",
        "minimum_max_version": "",
        "platform_compatibility": 0,
        "project": {
            "version": 1,
            "creationdate": 3874952706,
            "modificationdate": 3874952706,
            "viewrect": [ 0.0, 0.0, 300.0, 500.0 ],
            "autoorganize": 1,
            "hideprojectwindow": 1,
            "showdependencies": 1,
            "autolocalize": 0,
            "contents": {
                "patchers": {                }
            },
            "layout": {            },
            "searchpath": {            },
            "detailsvisible": 0,
            "amxdtype": 1633771873,
            "readonly": 0,
            "devpathtype": 0,
            "devpath": ".",
            "sortmode": 0,
            "viewmode": 0,
            "includepackages": 0
        },
        "autosave": 0,
        "oscreceiveudpport": 0
    }
}
