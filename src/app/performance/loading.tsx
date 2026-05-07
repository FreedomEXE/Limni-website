import LimniLoading from "@/components/LimniLoading";

export default function Loading() {
  return (
    <LimniLoading
      label="Loading Performance"
      compact
      phases={[
        "Checking artifacts",
        "Loading source fingerprints",
        "Preparing strategy view",
      ]}
    />
  );
}
