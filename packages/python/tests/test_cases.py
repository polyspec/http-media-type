"""The contract cases of http-media-type run against the installed Python package (MT-1 to MT-8).

HTTP_MEDIA_TYPE_CASES is the path of contracts/media-type.json; make test-python sets it. A text of the cases is
latin1 (MT-1.1), which the package takes and gives as a str of U+0000 to U+00FF.
"""

import json
import os
import unittest

import polyspec.http_media_type as media_types

CASES = os.environ["HTTP_MEDIA_TYPE_CASES"]


def load() -> dict:
    with open(CASES, encoding="utf-8") as file:
        return json.load(file)


def plain(media_type: media_types.MediaType) -> dict:
    return {
        "type": media_type.type,
        "subtype": media_type.subtype,
        "parameters": [{"name": p.name, "value": p.value} for p in media_type.parameters],
    }


class ContractCaseTest(unittest.TestCase):
    def check_raises(self, case: dict, call) -> None:
        raises = case["raises"]
        with self.assertRaises(Exception) as caught:
            call()
        error = caught.exception
        self.assertEqual(error.kind, raises["kind"])
        self.assertEqual(error.status, raises["status"])
        category = raises["category"].capitalize()
        self.assertIs(type(error), getattr(media_types, f"HttpMediaType{category}Error"))
        if raises["message"] is not None:
            self.assertEqual(str(error), raises["message"])

    def test_parse(self) -> None:
        group = load()["parse"]
        self.assertGreater(len(group), 0)
        for case in group:
            with self.subTest(case=case["id"]):
                call = lambda: media_types.parse(case["value"])  # noqa: E731
                if "raises" in case:
                    self.check_raises(case, call)
                else:
                    self.assertEqual(plain(call()), case["media_type"])

    def test_format(self) -> None:
        group = load()["format"]
        self.assertGreater(len(group), 0)
        for case in group:
            with self.subTest(case=case["id"]):
                m = case["media_type"]
                parameters = [media_types.Parameter(name=p["name"], value=p["value"]) for p in m["parameters"]]
                call = lambda: media_types.format(type=m["type"], subtype=m["subtype"], parameters=parameters)  # noqa: E731
                if "raises" in case:
                    self.check_raises(case, call)
                else:
                    self.assertEqual(call(), case["text"])

    def test_same_value(self) -> None:
        group = load()["sameValue"]
        self.assertGreater(len(group), 0)
        for case in group:
            with self.subTest(case=case["id"]):
                self.assertEqual(media_types.same_value(case["name"], case["left"], case["right"]), case["same"])


if __name__ == "__main__":
    unittest.main()
