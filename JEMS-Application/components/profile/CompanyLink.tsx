import Link from "next/link";

/** A company name that opens its profile — plain text for legacy listings with no company account. */
export default function CompanyLink({ id, name, className = "" }: { id?: string; name: string; className?: string }) {
  if (!id) return <span className={className}>{name}</span>;
  return (
    <Link href={`/view/company/${id}`} className={`${className} hover:text-slate hover:underline`} title={`View ${name}'s profile`}>
      {name}
    </Link>
  );
}
