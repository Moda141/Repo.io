import { Result, Button } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Result
      status="404"
      title={t('page.not_found.title')}
      subTitle={t('page.not_found.subtitle')}
      extra={
        <Link to={ROUTES.HOME}>
          <Button type="primary">{t('page.not_found.action')}</Button>
        </Link>
      }
    />
  );
}
