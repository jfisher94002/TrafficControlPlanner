/**
 * AWS Amplify configuration.
 *
 * Fill in the values below after running `amplify init && amplify add auth && amplify push`,
 * or copy them from the AWS Console → Cognito → User Pool → App Integration tab.
 *
 * Leave aws_user_pools_id empty to run the app without authentication (dev mode).
 */
const awsExports = {
  aws_project_region:           import.meta.env.VITE_AWS_REGION              ?? 'us-east-1',
  aws_cognito_region:           import.meta.env.VITE_AWS_REGION              ?? 'us-east-1',
  aws_user_pools_id:            import.meta.env.VITE_COGNITO_USER_POOL_ID    ?? '',
  aws_user_pools_web_client_id: import.meta.env.VITE_COGNITO_APP_CLIENT_ID   ?? '',
}

export default awsExports
