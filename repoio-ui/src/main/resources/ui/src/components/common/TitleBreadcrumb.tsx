import classNames from 'classnames';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * TitleBreadcrumb — direct port of OpenMetadata's
 * common/TitleBreadcrumb/TitleBreadcrumb.component.tsx with the same
 * HTML, class names and separator conventions:
 *   <nav class="breadcrumb-container">
 *     <ol class="rounded-4 text-sm font-regular d-flex flex-wrap">
 *       <li class="d-flex items-center breadcrumb-item">
 *         <Link class="link-title truncate" />
 *         <span class="text-sm font-regular p-x-xs text-grey-muted">/</span>
 *       </li>
 *     </ol>
 *   </nav>
 * Styles live in src/styles/app.less under `.breadcrumb-item .link-title`.
 */
export interface TitleLink {
  name: string;
  url?: string;
  activeTitle?: boolean;
  icon?: ReactNode;
}

interface Props {
  titleLinks: TitleLink[];
  className?: string;
  noLink?: boolean;
}

const SEPARATOR = '/';

export default function TitleBreadcrumb({
  titleLinks,
  className = '',
  noLink = false,
}: Props) {
  return (
    <nav
      className={classNames('breadcrumb-container', className)}
      data-testid="breadcrumb">
      <ol className="rounded-4 text-sm font-regular d-flex flex-wrap">
        {titleLinks.map((link, index) => {
          const classes =
            'link-title truncate' + (link.activeTitle ? ' font-medium' : '');
          const isLast = index === titleLinks.length - 1;
          return (
            <li
              className="d-flex items-center breadcrumb-item"
              data-testid="breadcrumb-link"
              key={`${link.name}-${index}`}>
              {!isLast && !noLink && link.url ? (
                <>
                  <Link className={classes} to={link.url}>
                    {link.icon}
                    {link.name}
                  </Link>
                  <span className="text-sm font-regular p-x-xs text-grey-muted">
                    {SEPARATOR}
                  </span>
                </>
              ) : link.url && !noLink ? (
                <Link className={classes} to={link.url}>
                  {link.icon}
                  {link.name}
                </Link>
              ) : (
                <span
                  className={classNames(classes, 'inactive-link cursor-text')}
                  data-testid="inactive-link">
                  {link.icon}
                  {link.name}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
