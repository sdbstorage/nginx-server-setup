import requests
from os.path import exists
import json
from hashlib import sha1
from sklearn.cluster import DBSCAN
from collections import defaultdict
from scipy.spatial import ConvexHull
import numpy

import ura

off_street_codes = [
    "A0024", "A0017", "A0046", "A0021", "A0007", "A0035", "A0011", "B0087",
    "B0098", "B0088", "B0032", "B0063", "C0133", "C0148", "C0162", "D0028",
    "D0026", "D0006", "E0027", "E0024", "E0023", "F0032", "G0004", "H0003",
    "H0057", "H0015", "H0004", "H0011", "H0024", "H0022", "J0054", "J0122",
    "J0100", "J0092", "J0055", "J0017", "K0082", "K0121", "K0039", "K0037",
    "K0111", "L0116", "L0064", "L0117", "L0123", "L0107", "L0104", "L0078",
    "L0125", "L0124", "M0084", "M0040", "M0059", "M0078", "M0076", "N0013",
    "N0012", "N0006", "O0028", "P0111", "P0093", "P0094", "P0113", "P0054",
    "P0106", "P0109", "P0033", "P0117", "P0096", "P0013", "Q0006", "Q0008",
    "S0166", "S0020", "S0049", "S0112", "S0055", "S0108", "S0171", "S0150",
    "T0141", "T0140", "T0129", "T0103", "U0036", "U0042", "V0007", "W0055",
    "W0029", "Y0019", "Y0021", "L0072", "O0033", "O0020", "B0006", "C0010",
    "B0009", "D0030", "O0019", "E0007", "A0025", "A0049", "B0005", "B0031",
    "B0023", "B0035", "B0101", "B0082", "B0086", "B0004", "B0099", "C0147",
    "C0151", "C0152", "C0153", "C0154", "C0155", "C0156", "C0119", "D0027",
    "D0029", "E0010", "F0029", "F0011", "F0031", "F0001", "F0022", "F0027",
    "G0037", "H0064", "J0056", "J0099", "J0128", "J0132", "K0032", "K0108",
    "L0058", "L0115", "L0086", "L0118", "M0017", "M0077", "M0079", "M0088",
    "O0005", "O0029", "O0031", "P0075", "P0048", "P0031", "P0103", "P0114",
    "R0037", "R0040", "S0106", "S0109", "S0111", "S0013", "S0151", "T0017",
    "T0001", "T0107", "T0109", "T0131", "T0151", "T0144", "T0148", "T0153",
    "U0040", "U0043", "Y0017", "Y0020", "Z0001",
]


def generate_hash(x):
    a = sha1()
    a.update(x.encode())
    return a.hexdigest()[:8]


def route(
        start="1.320981,103.844150", end="1.326762,103.8559",
        routeType="drive",  # walk, drive, pt, cycle
):
    auth = f"""
        eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3NmExN2MzOWFjYzF
        iYzM4NDFkOTIzOWU2ZWZmZmRlNyIsImlzcyI6Imh0dHA6Ly9pbnRlcm5hbC1hbGI
        tb20tcHJkZXppdC1pdC0xMjIzNjk4OTkyLmFwLXNvdXRoZWFzdC0xLmVsYi5hbWF
        6b25hd3MuY29tL2FwaS92Mi91c2VyL3Bhc3N3b3JkIiwiaWF0IjoxNjk0MTYzMTI
        4LCJleHAiOjE2OTQ0MjIzMjgsIm5iZiI6MTY5NDE2MzEyOCwianRpIjoieGhrak9
        TT3VQMkM4UFhFdCIsInVzZXJfaWQiOjcwNCwiZm9yZXZlciI6ZmFsc2V9.Dd8VqN
        OL4rSnPJl6DxZDuwEVs2S1ei3mbjfNVdqqugs=
    """
    auth = "".join(auth.split())
    host = "https://www.onemap.gov.sg"
    params = dict(start=start, end=end, routeType=routeType)
    params = "&".join(f"{k}={v}" for k, v, in params.items())
    url = f"{host}/api/public/routingsvc/route?{params}"
    cache_path = f"route/{generate_hash(params)}.json"
    if not exists(cache_path):
        print(url)
        response = requests.get(url, headers=dict(Authorization=auth))
        with open(cache_path, "wb") as f:
            f.write(response.content)
    with open(cache_path) as f:
        return json.loads(f.read())


def cluster():
    lots = ura.get_lot()
    lots = [i for i in lots if i["TYPE"] in ["Car Lots", "Lorry Lots"]]
    lots = [i for i in lots if i["PP_CODE"] not in off_street_codes]
    for lot in lots:
        lot.pop("LOT_NO")
        lot.pop("TYPE")
        lot.pop("PARKING_PL")
        geometry = lot.pop("GEOMETRY")
        if isinstance(geometry[0], list):
            center = geometry[0]
        else:
            center = geometry
        lot["CENTER"] = center
    dbscan = DBSCAN(eps=500, min_samples=1)
    dbscan.fit([i["CENTER"] for i in lots])
    clusters = defaultdict(list)
    for i, label in enumerate(dbscan.labels_):
        clusters[label].append(lots[i])
    clusters = list(clusters.values())
    clusters.sort(key=lambda x: len(x))
    clusters = [i for i in clusters if len(i) > 100][-100:]
    print([len(i) for i in clusters])
    polygons = []
    for cluster_lots in clusters:
        centers = [i["CENTER"] for i in cluster_lots]
        vertices = [centers[i] for i in ConvexHull(centers).vertices]
        pp_codes = defaultdict(int)
        for i in cluster_lots:
            pp_codes[i["PP_CODE"]] += 1
        pp_codes = pp_codes.items()
        pp_codes = sorted(pp_codes, key=lambda x: x[1], reverse=True)
        polygons.append([
            [[round(vv, 3) for vv in v] for v in vertices],
            [i[0] for i in pp_codes],
        ])
    return polygons


with open("clusters.json", "w") as f:
    f.write(json.dumps(cluster()))
