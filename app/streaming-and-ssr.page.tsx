import { Suspense } from "react";

export default function Page() {
  return (
    <div>
      <Suspense fallback={<Loading />}>
        <SlowComponent delay={1000} />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
      Loading
    </div>
  );
}

async function SlowComponent({ delay }: { delay: number }) {
  await new Promise((resolve) => setTimeout(resolve, delay));
  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-4">
      Loaded after {delay}ms
    </div>
  );
}
