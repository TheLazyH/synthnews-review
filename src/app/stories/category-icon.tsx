import {
  Briefcase,
  Clapperboard,
  Cpu,
  Globe,
  GraduationCap,
  Landmark,
  Newspaper,
  Trophy,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  india: Landmark,
  world: Globe,
  entertainment: Clapperboard,
  sports: Trophy,
  technology: Cpu,
  business: Briefcase,
  education: GraduationCap,
};

export default function CategoryIcon({
  category,
  className,
}: {
  category: string | null;
  className?: string;
}) {
  const Icon = (category && ICONS[category.toLowerCase()]) || Newspaper;
  return <Icon className={className} aria-hidden="true" />;
}
