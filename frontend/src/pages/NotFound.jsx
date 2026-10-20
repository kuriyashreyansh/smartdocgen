import { EmptyState, Button } from "../components/ui";
export default function NotFound() {
  return <EmptyState icon="alert" title="Page not found" action={<Button variant="primary" to="/">Back to dashboard</Button>}>The page you are looking for does not exist.</EmptyState>;
}
