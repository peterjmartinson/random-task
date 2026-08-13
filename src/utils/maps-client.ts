import axios from 'axios';

export interface DriveTimeResult {
  durationMinutes: number;
  distanceText?: string;
  source: 'google_maps' | 'estimated' | 'failed';
}

export async function calculateDriveTime(
  origin: string,
  destination: string,
  departureTimeIso?: string,
  apiKey?: string
): Promise<DriveTimeResult | null> {
  if (!origin || !destination) return null;

  // Normalize locations
  if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
    return { durationMinutes: 0, distanceText: '0 mi', source: 'google_maps' };
  }

  if (apiKey) {
    try {
      const departureEpoch = departureTimeIso
        ? Math.floor(new Date(departureTimeIso).getTime() / 1000)
        : 'now';

      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/distancematrix/json',
        {
          params: {
            origins: origin,
            destinations: destination,
            departure_time: departureEpoch,
            key: apiKey,
          },
          timeout: 5000,
        }
      );

      if (
        response.data?.status === 'OK' &&
        response.data?.rows?.[0]?.elements?.[0]?.status === 'OK'
      ) {
        const element = response.data.rows[0].elements[0];
        const durationSeconds =
          element.duration_in_traffic?.value ?? element.duration?.value ?? 900;
        const durationMinutes = Math.round(durationSeconds / 60);

        return {
          durationMinutes,
          distanceText: element.distance?.text,
          source: 'google_maps',
        };
      }
    } catch (error) {
      console.warn(`Maps API call failed: ${(error as Error).message}. Falling back to estimate.`);
    }
  }

  // Safe heuristic fallback when Maps API key is not present or API call fails
  return {
    durationMinutes: 15,
    distanceText: 'approx',
    source: 'estimated',
  };
}
