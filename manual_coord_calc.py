# UTM Zone 32N to WGS84 conversion
# Using the standard formulas

import math

# UTM coordinates from the API response
easting = 596876
northing = 6644949

# UTM Zone 32N parameters
zone = 32
central_meridian = (zone - 1) * 6 - 180 + 3  # 9 degrees for zone 32

# WGS84 ellipsoid parameters
a = 6378137.0  # Semi-major axis
f = 1 / 298.257223563  # Flattening
e2 = 2 * f - f**2  # First eccentricity squared

# Scale factor
k0 = 0.9996

# False easting and northing
E0 = 500000
N0 = 0  # Northern hemisphere

# Adjust coordinates
x = easting - E0
y = northing - N0

# Calculate footpoint latitude
M = y / k0
mu = M / (a * (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256))

# Calculate latitude
e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
J1 = 3*e1/2 - 27*e1**3/32
J2 = 21*e1**2/16 - 55*e1**4/32
J3 = 151*e1**3/96
J4 = 1097*e1**4/512

fp = mu + J1*math.sin(2*mu) + J2*math.sin(4*mu) + J3*math.sin(6*mu) + J4*math.sin(8*mu)

# Calculate constants
ep2 = e2 / (1 - e2)
C1 = ep2 * math.cos(fp)**2
T1 = math.tan(fp)**2
R1 = a * (1 - e2) / (1 - e2 * math.sin(fp)**2)**1.5
N1 = a / math.sqrt(1 - e2 * math.sin(fp)**2)
D = x / (N1 * k0)

# Calculate latitude
lat = fp - (N1 * math.tan(fp) / R1) * (D**2/2 - (5 + 3*T1 + 10*C1 - 4*C1**2 - 9*ep2) * D**4/24 + (61 + 90*T1 + 298*C1 + 45*T1**2 - 252*ep2 - 3*C1**2) * D**6/720)

# Calculate longitude
lon = (D - (1 + 2*T1 + C1) * D**3/6 + (5 - 2*C1 + 28*T1 - 3*C1**2 + 8*ep2 + 24*T1**2) * D**5/120) / math.cos(fp)
lon = math.radians(central_meridian) + lon

# Convert to degrees
lat_deg = math.degrees(lat)
lon_deg = math.degrees(lon)

print(f"UTM Coordinates (EPSG:32632):")
print(f"  East: {easting}")
print(f"  North: {northing}")
print(f"\nWGS84 Coordinates (EPSG:4326):")
print(f"  Latitude: {lat_deg:.6f}")
print(f"  Longitude: {lon_deg:.6f}")
print(f"\nGoogle Maps URL:")
print(f"  https://www.google.com/maps/search/?api=1&query={lat_deg:.6f},{lon_deg:.6f}")

# Let's also estimate what the coordinates might be for Thereses gate 11A
# Based on Oslo's general location around 59.9°N, 10.7°E
print(f"\nExpected approximate location for Oslo address:")
print(f"  Latitude: ~59.92")
print(f"  Longitude: ~10.74")
