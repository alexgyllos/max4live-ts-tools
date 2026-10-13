{
  "patcher": {
    "fileversion": 1,
    "classnamespace": "box",
    "boxes": [
      {
        "box": {
          "id": "obj-1",
          "maxclass": "newobj",
          "text": "loadbang",
          "numinlets": 0,
          "numoutlets": 1,
          "patching_rect": [
            20,
            20,
            80,
            22
          ],
          "saved_object_attributes": {
            "extra": [
              1,
              2
            ]
          }
        },
        "wrapper_extension": {
          "test": true
        }
      },
      {
        "box": {
          "id": "obj-2",
          "maxclass": "newobj",
          "text": "print",
          "numinlets": 1,
          "numoutlets": 0,
          "patching_rect": [
            20,
            60,
            60,
            22
          ]
        }
      }
    ],
    "lines": [
      {
        "patchline": {
          "source": [
            "obj-1",
            0
          ],
          "destination": [
            "obj-2",
            0
          ],
          "order": 0,
          "midpoints": [
            1,
            2,
            3,
            4
          ]
        },
        "wrapper_extension": 42
      }
    ],
    "appversion": {
      "major": 9
    },
    "extension": {
      "a": 1
    }
  },
  "root_extension": {
    "future": [
      true,
      null,
      3
    ]
  }
}
