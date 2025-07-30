from pyproj import Transformer

# Create transformer from UTM zone 32N to WGS84
transformer = Transformer.from_crs("EPSG:32632", "EPSG:4326", always_xy=True)

# Coordinates from API response
east = 596876
north = 6644949

# Convert
lon, lat = transformer.transform(east, north)

print(f"UTM Coordinates (EPSG:32632):")
print(f"  East: {east}")
print(f"  North: {north}")
print(f"\nWGS84 Coordinates (EPSG:4326):")
print(f"  Latitude: {lat:.6f}")
print(f"  Longitude: {lon:.6f}")
print(f"\nGoogle Maps URL:")
print(f"  https://www.google.com/maps/search/?api=1&query={lat:.6f},{lon:.6f}")
