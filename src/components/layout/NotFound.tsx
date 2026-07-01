import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Catch-all 404 page. Rendered for any unmatched route so broken or stale
 * links land somewhere navigable instead of a blank screen.
 */
const NotFound = () => {
	return (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<Compass className="h-14 w-14 text-muted-foreground mb-4" />
			<h1 className="text-3xl font-bold text-foreground">Page not found</h1>
			<p className="text-muted-foreground mt-2 max-w-md">
				The page you&apos;re looking for doesn&apos;t exist or may have moved.
			</p>
			<div className="flex flex-wrap justify-center gap-4 mt-6">
				<Link to="/">
					<Button size="lg">Back to Home</Button>
				</Link>
				<Link to="/proposals">
					<Button variant="outline" size="lg">
						View Proposals
					</Button>
				</Link>
			</div>
		</div>
	);
};

export default NotFound;
