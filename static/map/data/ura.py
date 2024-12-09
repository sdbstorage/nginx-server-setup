from osgeo import ogr
from json import loads
from msgpack import dumps
from re import split


def parse_feature(feature):
    geometry = feature.geometry()
    geometry_name = geometry.GetGeometryName()
    if geometry_name in ["MULTIPOLYGON", "POINT"]:
        pass
    elif geometry_name in ["MULTISURFACE"]:
        # TODO: simplify shape
        geometry = geometry.Centroid()
    else:
        assert False, geometry_name
    geometry = loads(geometry.ExportToJson())
    geometry = geometry["coordinates"]
    while isinstance(geometry, list) and len(geometry) == 1:
        geometry = geometry[0]
    entry = dict(
        FID=feature.GetFID(),
        GEOMETRY=geometry,
        # CENTER=center,
    )
    entry.update(feature.items())
    entry.pop("FID")
    entry.pop("INC_CRC")
    entry.pop("FMEL_UPD_D")
    entry.pop("SHAPE_Area")
    entry.pop("SHAPE_Length")
    return entry


def read_gdb(gdb_path):
    data_source = ogr.Open(gdb_path)
    assert data_source, f"{gdb_path} is not a valid gdb file"
    features = [parse_feature(f) for f in data_source.GetLayer()]
    return features


def get_lot(): return read_gdb("ura/URA_PARKING_LOT.gdb")
def get_capacity(): return read_gdb("ura/URA_PARKING_CAPACITY_PT.gdb")


if __name__ == "__main__":

    def recur(x, f):
        if isinstance(x, list):
            return [recur(i, f) for i in x]
        elif isinstance(x, dict):
            return {recur(k, f): recur(v, f) for k, v in x.items()}
        else:
            return f(x)

    def extract_tokens(x):
        dst = []
        recur(x, lambda xx: dst.append(xx.split("(")[0].lower())
              if isinstance(xx, str) else None)
        dst = set(j for i in dst for j in i.split() if j)
        print(len(dst), len(set(dst)))
        print(dst)

    def tokenise(x):
        return [i for i in (x or "").split("(")[0].lower().split() if i]

    def serialise(x):
        # NOTE: encode strings
        str_keys = ["TYPE", "PARKING_PL"]
        str_indices = [x[0].index(k) for k in str_keys if k in x[0]]
        tokens = sorted(set(
            k
            for str_index in str_indices for xx in x[1:]
            for k in tokenise(xx[str_index])))
        for index in str_indices:
            for xx in x[1:]:
                xx[index] = [tokens.index(i) for i in tokenise(xx[index])]
        # NOTE: encode parking codes
        code_keys = ["PP_CODE", "LOT_NO"]
        code_indices = [x[0].index(k) for k in code_keys if k in x[0]]
        for index in code_indices:
            for xx in x[1:]:
                code = xx[index]
                if code is not None:
                    code = split(r"(\d+|[A-Za-z]+)", code)
                    xx[index] = [int(i) if i.isnumeric() else i
                                 for i in code if i]
        x = [tokens] + x
        print(x[:10])
        return dumps(x, use_single_float=True)

    with open("lot.msgpack", "wb") as f:
        f.write(serialise(get_lot()))
    with open("capacity.msgpack", "wb") as f:
        f.write(serialise(get_capacity()))
