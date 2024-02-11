let count = 0;

function increment() {
  "use server";
  count = count + 1;
}

export default function Page() {
  return (
    <div>
      <p>The count is: {count}</p>

      <form action={increment}>
        <button type="submit">Increment</button>
      </form>
    </div>
  );
}
