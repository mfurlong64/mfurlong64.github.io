"""Rebuild data/construct.sqlite.gz, the browser console's snapshot of construct-analyst.

Run from the construct-analyst venv (it has google-cloud-bigquery and pandas):

    ../construct-analyst/.venv/bin/python tools/build_snapshot.py

Step 1 exports six tables from BigQuery (widest snapshot per L1 table, ~41 MiB
scanned in total, every query dry-run first and refused over 100 MiB). Step 2
builds the SQLite file with the mart views and the column notes, trims the
App Store sweep to six storefronts, and gzips it. Only the .gz is committed.
"""
import pathlib, time, sys
import pandas as pd

P = "project-7c859da6-dddd-4a26-8da"
ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPORT = ROOT / "tools" / "export"; EXPORT.mkdir(exist_ok=True)

def export():
    from google.cloud import bigquery
    c = bigquery.Client(project=P)
    def q(sql, timeout=240):
        rows = c.query(sql).result(timeout=timeout)   # no storage client: it hung for hours
        return pd.DataFrame([list(r.values()) for r in rows], columns=[f.name for f in rows.schema])
    def widest(table):
        r = q(f"SELECT ingested_date, COUNT(*) n FROM `{P}.l1_clean.{table}` GROUP BY 1 ORDER BY n DESC, ingested_date DESC LIMIT 1").iloc[0]
        return str(r.ingested_date)
    Q = {}
    d = widest("launches")
    Q["launches"] = f"""SELECT launch_id, provider, name, net, has_flown, status, launch_year, rocket_config, rocket_family,
      orbit, orbit_name, mission_name, mission_type, pad_name, pad_location, pad_country, pad_lat, pad_lon, failreason, program
    FROM `{P}.l1_clean.launches` WHERE ingested_date='{d}'"""
    Q["boosters"] = f"""SELECT booster_id, provider, serial_number, flights, flight_proven, status, config_name, config_family, first_launch_date, last_launch_date
    FROM `{P}.l1_clean.boosters` WHERE ingested_date=(SELECT MAX(ingested_date) FROM `{P}.l1_clean.boosters`)"""
    d = widest("satellites")
    Q["satellites"] = f"""SELECT norad_cat_id, object_group, object_name, object_id, launch_year, epoch, inclination_deg, raan_deg, eccentricity, mean_motion,
      period_min, apogee_km, perigee_km, mean_altitude_km, orbit_class, bstar
    FROM `{P}.l1_clean.satellites` WHERE ingested_date='{d}'"""
    d = widest("appstore_charts")
    Q["appstore_charts"] = f"""SELECT app_id, artist_id, artist_name, name, genres_json, genre_ids_json, avg_user_rating, rating_count, price_usd_cents,
      DATE(release_date) AS release_date, DATE(current_version_release_date) AS version_date, file_size_bytes, is_game_center,
      chart_type, chart_genre, chart_country, chart_rank
    FROM `{P}.l1_clean.appstore_charts` WHERE ingested_date='{d}'"""
    d = widest("itch_games")
    Q["itch_games"] = f"""SELECT game_id, title, author_name, genre, avg_rating, rating_count, price_usd_cents, is_free, playable_in_browser, platform_count, browse_sort, browse_rank
    FROM `{P}.l1_clean.itch_games` WHERE ingested_date='{d}'"""
    Q["ingest_runs"] = f"SELECT * FROM `{P}.meta.ingest_runs` ORDER BY 1"
    for name, sql in Q.items():
        dry = c.query(sql, job_config=bigquery.QueryJobConfig(dry_run=True, use_query_cache=False))
        mb = dry.total_bytes_processed / 2**20
        if mb >= 100: sys.exit(f"{name} would scan {mb:.0f} MiB; refusing")
        t = time.time(); df = q(sql); df.to_pickle(EXPORT / f"{name}.pkl")
        print(f"{name:16s} {len(df):7d} rows  {mb:6.1f} MiB scanned  {time.time()-t:5.1f}s")

if __name__ == "__main__" and "--build-only" not in sys.argv:
    export()

# ---- step 2: the SQLite file ------------------------------------------------
SP=EXPORT; OUT=ROOT/'data'; OUT.mkdir(exist_ok=True)
db=OUT/'construct.sqlite'
if db.exists(): db.unlink()
con=sqlite3.connect(db)

def clean(df):
    for c in df.columns:
        s=df[c]
        if str(s.dtype).startswith('datetime') or 'date' in str(s.dtype).lower():
            df[c]=s.astype(str).where(s.notna(), None)
        elif s.dtype==object and len(s) and isinstance(s.dropna().iloc[0] if len(s.dropna()) else None,(pd.Timestamp,)):
            df[c]=s.astype(str).where(s.notna(), None)
        elif str(s.dtype)=='boolean' or s.dtype==bool:
            df[c]=s.astype('Int64')
        elif s.dtype==object:
            df[c]=s.map(lambda v: None if v is None or (isinstance(v,float) and pd.isna(v)) else (str(v) if not isinstance(v,(str,int,float)) else v))
    return df

meta=[]  # (table, column, note)
def load(name, notes):
    df=pd.read_pickle(SP/f'{name}.pkl')
    df=clean(df)
    df.to_sql(name, con, index=False)
    for c in df.columns: meta.append((name,c,notes.get(c,'')))
    print(f'{name:16s} {len(df):7d} rows {len(df.columns):3d} cols')
    return df

load('launches',{'launch_id':'Launch Library 2 UUID','provider':'SpaceX or Rocket Lab','net':'No Earlier Than; the real T-0 once flown','has_flown':'1 only for Success/Failure/Partial. The filter that matters','status':'Success, Failure, Partial, Go, TBD, TBC…','launch_year':'derived from net; a planned year for scheduled rows','orbit':'LEO, GTO, SSO, Sub…','pad_lat':'real coordinates on every row','failreason':'populated only on failures','program':'comma-separated programme names'})
load('boosters',{'flights':'lifetime flights; max is 36 (B1067)','status':'active, expended, lost, retired, destroyed, scrapped, converted','provider':'derived from the vehicle name; NULL means unrecognised, never a guess'})
load('satellites',{'norad_cat_id':'catalogue number, the stable object key','object_group':'active, starlink, oneweb, stations, geo. Part of the grain','object_id':'international designator YYYY-NNNP, the launch it came from','mean_motion':'revolutions per day','period_min':'derived at ingest via Kepler; ISS checks out at 92.9 min','orbit_class':'LEO MEO GEO HEO BEYOND_GEO; HEO checked first','bstar':'drag term; rising BSTAR with falling perigee is what reentry looks like'})
ap=pd.read_pickle(SP/'appstore_charts.pkl')
ap=ap[ap['chart_country'].isin(['us','gb','de','jp','kr','br']) & ~ap['chart_type'].str.endswith('-ipad')]
ap=ap.drop_duplicates(['app_id','chart_type','chart_genre','chart_country'])
print('appstore trimmed to',len(ap),'rows')
def subgenre(row):
    try:
        g=json.loads(row['genres_json']); ids=json.loads(row['genre_ids_json'])
    except Exception: return None
    for name,i in zip(g,ids):
        try:
            if 7001<=int(i)<=7019: return name
        except Exception: pass
    return None
ap['subgenre']=ap.apply(subgenre,axis=1)
ap=ap.drop(columns=['genres_json','genre_ids_json'])
ap.to_pickle(SP/'appstore_charts.pkl')
load('appstore_charts',{'artist_id':'stable publisher key; group by this, not artist_name','subgenre':'first Apple game subgenre (ids 7001–7019), US storefront label','rating_count':'an install-scale proxy only','price_usd_cents':'0 on the free charts by construction','chart_type':'top-free, top-paid, top-grossing, and -ipad variants','chart_genre':'which of the 17 genre charts the row came from; games is the overall chart','chart_country':'2-letter storefront code','chart_rank':'1–100; the feed caps at 100 per chart, so use SUM(101-chart_rank) for chart points'})
load('itch_games',{'genre':'itch\'s own taxonomy, 83% populated','browse_sort':'which browse sort the row came from','browse_rank':'position within that sort','playable_in_browser':'runs in the page'})
load('ingest_runs',{})

con.executescript("""
CREATE VIEW dim_vehicle AS
  SELECT rocket_config AS vehicle_name, MAX(rocket_family) AS vehicle_family, MAX(provider) AS operator_name,
         SUM(has_flown) AS flights_flown, SUM(has_flown AND status='Success') AS flights_successful,
         MIN(CASE WHEN has_flown THEN launch_year END) AS debut_year
  FROM launches GROUP BY rocket_config;
CREATE VIEW dim_orbit AS
  SELECT orbit AS orbit_abbrev, MAX(orbit_name) AS orbit_name, SUM(has_flown) AS launches_flown FROM launches GROUP BY orbit;
CREATE VIEW dim_pad AS
  SELECT pad_name, MAX(pad_location) AS pad_location, MAX(pad_country) AS pad_country, MAX(pad_lat) AS pad_lat, MAX(pad_lon) AS pad_lon,
         SUM(has_flown) AS launches_flown, MIN(CASE WHEN has_flown THEN launch_year END) AS first_year FROM launches GROUP BY pad_name;
CREATE VIEW dim_booster AS
  SELECT booster_id, serial_number, provider AS operator_name, config_name AS vehicle_name, config_family AS vehicle_family,
         flights AS flights_lifetime, COALESCE(flight_proven,0) AS is_flight_proven, status AS core_status, status='active' AS is_active,
         first_launch_date, last_launch_date FROM boosters;
CREATE VIEW fct_launch AS
  SELECT launch_id, provider AS operator_name, rocket_config AS vehicle_name, pad_name, orbit AS orbit_abbrev, name AS launch_name,
         net AS launched_at, substr(net,1,10) AS launch_date, launch_year, status AS status_abbrev, has_flown AS is_flown,
         (has_flown AND status='Success') AS is_success, (has_flown AND status<>'Success') AS is_anomaly, (NOT has_flown) AS is_scheduled, 1 AS launch_count
  FROM launches;
CREATE TABLE _columns (table_name TEXT, column_name TEXT, note TEXT);
""")
for t in ['dim_vehicle','dim_orbit','dim_pad','dim_booster','fct_launch']:
    for r in con.execute(f'PRAGMA table_info({t})'): meta.append((t,r[1],''))
con.executemany('INSERT INTO _columns VALUES (?,?,?)',meta)
con.commit(); con.execute('VACUUM'); con.close()
raw=db.read_bytes(); gz=OUT/'construct.sqlite.gz'; gz.write_bytes(gzip.compress(raw,9)); db.unlink()
print('sqlite',len(raw)//1024,'KB  gzip',len(gz.read_bytes())//1024,'KB')
