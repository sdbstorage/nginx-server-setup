from datetime import datetime, timedelta
from os.path import exists
import requests
import json
import msgpack

HOST = "https://www.v3nity.com/V3Nity4"
ASSET_ID = 7756
DATETIME_FORMAT = "%d/%m/%Y %H:%M:%S"


def parse(x):
    try:
        return float(x)
    except ValueError:
        return int(datetime.strptime(x, DATETIME_FORMAT).timestamp())


def get_history(y, m, d):  # get session identifier from remote server
    output_path = f"{y:04d}{m:02d}{d:02d}.msgpack"
    if exists(output_path):
        # print("skip", output_path)
        return
    with requests.Session() as session:
        response = session.post(
            f"{HOST}/LoginController?action=login&language=en",
            json=dict(username="ck", password="ckckck"))
        assert response.status_code == 200, response.status_code
        start = datetime(y, m, d)
        end = start + timedelta(days=1)
        query = json.dumps([
            dict(
                field="timestamp", type="DateRange",
                value1=start.strftime(DATETIME_FORMAT),
                value2=end.strftime(DATETIME_FORMAT),
            ),
            dict(
                field="asset_id", type="Integer",
                operator="IN", value=[str(ASSET_ID)],
            )
        ])
        response = session.post(
            f"{HOST}/ListController?lib=v3nity.std.biz.report&type=History&format=csv&action=view",
            headers={"content-type": "application/x-www-form-urlencoded"},
            data=f"draw=0&totalRecords=1&start=0&length=1000000&customFilterQuery={query}",
        )
        keys = ["Timestamp", "Latitude", "Longitude"]
        rows = [[j.strip('"') for j in i.split(",")]
                for i in response.text.split("\n") if i]
        indices = [rows[0].index(key) for key in keys]
        values = [[parse(row[index]) for index in indices] for row in rows[1:]]
    print("write", output_path)
    with open(output_path, "wb") as f:
        f.write(msgpack.dumps(values, use_single_float=True))


if __name__ == "__main__":
    date = datetime(2023, 8, 29)
    while date.date() < datetime.now().date():
        get_history(date.year, date.month, date.day)
        date += timedelta(days=1)
