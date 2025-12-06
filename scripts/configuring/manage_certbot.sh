#!/bin/bash

# Certbot Certificate Management Script
# Usage: manage_certbot.sh <action> [domain] [email] [webroot] [webserver]

action="$1"
domain="$2"
email="$3"
webroot="${4:-/var/www/html}"
webserver="${5:-nginx}"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt-get update
    apt-get install -y certbot
    
    # Install appropriate plugin based on webserver
    if [ "$webserver" == "nginx" ]; then
        apt-get install -y python3-certbot-nginx
    elif [ "$webserver" == "apache" ]; then
        apt-get install -y python3-certbot-apache
    fi
fi

case "$action" in
    "obtain")
        if [ -z "$domain" ] || [ -z "$email" ]; then
            echo "Error: Domain and email are required for obtaining certificates"
            echo "Usage: manage_certbot.sh obtain <domain> <email> [webroot] [webserver]"
            exit 1
        fi
        
        echo "Obtaining certificate for $domain..."
        
        if [ "$webserver" == "nginx" ]; then
            certbot --nginx -d "$domain" --non-interactive --agree-tos --email "$email"
        elif [ "$webserver" == "apache" ]; then
            certbot --apache -d "$domain" --non-interactive --agree-tos --email "$email"
        else
            # Standalone or webroot mode
            certbot certonly --webroot -w "$webroot" -d "$domain" --non-interactive --agree-tos --email "$email"
        fi
        
        if [ $? -eq 0 ]; then
            echo "✅ Certificate obtained successfully for $domain"
        else
            echo "❌ Failed to obtain certificate for $domain"
            exit 1
        fi
        ;;
        
    "renew")
        echo "Renewing certificates..."
        certbot renew --quiet
        
        if [ $? -eq 0 ]; then
            echo "✅ Certificate renewal completed"
            
            # Reload webserver if certificates were renewed
            if [ "$webserver" == "nginx" ]; then
                systemctl reload nginx
            elif [ "$webserver" == "apache" ]; then
                systemctl reload apache2
            fi
        else
            echo "❌ Certificate renewal failed"
            exit 1
        fi
        ;;
        
    "renew-test")
        echo "Testing certificate renewal (dry-run)..."
        certbot renew --dry-run
        
        if [ $? -eq 0 ]; then
            echo "✅ Certificate renewal test passed"
        else
            echo "❌ Certificate renewal test failed"
            exit 1
        fi
        ;;
        
    "list")
        echo "Listing all certificates..."
        certbot certificates
        ;;
        
    "revoke")
        if [ -z "$domain" ]; then
            echo "Error: Domain is required for revoking certificates"
            echo "Usage: manage_certbot.sh revoke <domain>"
            exit 1
        fi
        
        echo "Revoking certificate for $domain..."
        certbot revoke --cert-path "/etc/letsencrypt/live/$domain/cert.pem" --non-interactive
        
        if [ $? -eq 0 ]; then
            echo "✅ Certificate revoked successfully for $domain"
            
            # Delete certificate files
            rm -rf "/etc/letsencrypt/live/$domain"
            rm -rf "/etc/letsencrypt/archive/$domain"
            rm -rf "/etc/letsencrypt/renewal/$domain.conf"
            
            echo "✅ Certificate files deleted"
        else
            echo "❌ Failed to revoke certificate for $domain"
            exit 1
        fi
        ;;
        
    "delete")
        if [ -z "$domain" ]; then
            echo "Error: Domain is required for deleting certificates"
            echo "Usage: manage_certbot.sh delete <domain>"
            exit 1
        fi
        
        echo "Deleting certificate for $domain..."
        certbot delete --cert-name "$domain" --non-interactive
        
        if [ $? -eq 0 ]; then
            echo "✅ Certificate deleted successfully for $domain"
        else
            echo "❌ Failed to delete certificate for $domain"
            exit 1
        fi
        ;;
        
    "info")
        if [ -z "$domain" ]; then
            echo "Error: Domain is required for certificate info"
            echo "Usage: manage_certbot.sh info <domain>"
            exit 1
        fi
        
        echo "Certificate information for $domain:"
        certbot certificates | grep -A 10 "$domain" || echo "No certificate found for $domain"
        ;;
        
    "upgrade")
        # Upgrade from self-signed to Let's Encrypt certificate
        if [ -z "$domain" ] || [ -z "$email" ]; then
            echo "Error: Domain and email are required for upgrading certificates"
            echo "Usage: manage_certbot.sh upgrade <domain> <email> [foldername]"
            exit 1
        fi
        
        foldername="${4:-$domain}"
        nginx_config="/etc/nginx/sites-available/$foldername"
        nginx_config_enabled="/etc/nginx/sites-enabled/$foldername"
        
        # Check if nginx config exists
        if [ ! -f "$nginx_config" ]; then
            echo "❌ Nginx configuration file not found: $nginx_config"
            echo "Please specify the correct foldername used when configuring nginx"
            exit 1
        fi
        
        echo "🔄 Upgrading certificate for $domain from self-signed to Let's Encrypt..."
        
        # Extract webroot path from existing config before modifying
        webroot_path=$(grep -m 1 "^[[:space:]]*root" "$nginx_config" | awk '{print $2}' | tr -d ';' || echo "/var/www/$foldername")
        echo "📁 Detected webroot: $webroot_path"
        
        # Step 1: Temporarily modify nginx config to allow HTTP access for ACME challenge
        echo "📝 Step 1: Preparing nginx configuration for ACME challenge..."
        
        # Create a backup
        backup_file="${nginx_config}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$nginx_config" "$backup_file"
        echo "💾 Backup created: $backup_file"
        
        # Check if config has HTTPS redirect or SSL
        if grep -q "return 301 https" "$nginx_config" || grep -q "ssl_certificate" "$nginx_config"; then
            # Create temporary config that allows HTTP for ACME challenge
            mkdir -p /var/www/html/.well-known/acme-challenge
            cat > "$nginx_config" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $domain;
    
    # Allow ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Temporarily allow HTTP access (will be redirected after certificate is obtained)
    location / {
        root $webroot_path;
        index index.php index.html index.htm;
        
        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/run/php/php-fpm.sock;
        }
    }
}
EOF
            
            # Reload nginx to apply temporary config
            systemctl reload nginx
            echo "✅ Temporary nginx configuration applied"
        fi
        
        # Step 2: Obtain Let's Encrypt certificate
        echo "📜 Step 2: Obtaining Let's Encrypt certificate..."
        
        # Step 2: Obtain Let's Encrypt certificate using nginx plugin
        echo "📜 Step 2: Obtaining Let's Encrypt certificate..."
        
        certbot --nginx -d "$domain" --non-interactive --agree-tos --email "$email" --redirect
        
        if [ $? -ne 0 ]; then
            echo "⚠️  Nginx plugin failed, trying webroot method..."
            certbot certonly --webroot -w "$webroot_path" -d "$domain" --non-interactive --agree-tos --email "$email"
            
            if [ $? -eq 0 ]; then
                # Update nginx config manually to use Let's Encrypt certificates
                echo "📝 Step 3: Updating nginx configuration to use Let's Encrypt certificates..."
                
                cat > "$nginx_config" <<EOF
# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $domain;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $domain;
    
    # Let's Encrypt certificates
    ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    root $webroot_path;
    index index.php index.html index.htm index.nginx-debian.html;
    
    location / {
        try_files \$uri \$uri/ =404;
    }
    
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php-fpm.sock;
    }
}
EOF
            else
                echo "❌ Failed to obtain certificate. Restoring backup..."
                cp "$backup_file" "$nginx_config"
                systemctl reload nginx
                exit 1
            fi
        fi
        
        if [ $? -eq 0 ]; then
            echo "✅ Certificate obtained successfully"
            
            # Step 3: Test nginx configuration
            echo "🧪 Step 3: Testing nginx configuration..."
            nginx -t
            
            if [ $? -eq 0 ]; then
                # Step 4: Reload nginx
                echo "🔄 Step 4: Reloading nginx..."
                systemctl reload nginx
                
                echo "✅ Successfully upgraded to Let's Encrypt certificate for $domain"
                echo ""
                echo "📋 Summary:"
                echo "  - Let's Encrypt certificate installed"
                echo "  - Nginx configuration updated"
                echo "  - HTTP to HTTPS redirect enabled"
                echo "  - Old self-signed certificate can be removed from /etc/nginx/ssl/"
            else
                echo "❌ Nginx configuration test failed. Restoring backup..."
                cp "$backup_file" "$nginx_config"
                systemctl reload nginx
                exit 1
            fi
        ;;
        
    *)
        echo "Certbot Certificate Management"
        echo ""
        echo "Usage: manage_certbot.sh <action> [options]"
        echo ""
        echo "Actions:"
        echo "  obtain <domain> <email> [webroot] [webserver]  - Obtain a new certificate"
        echo "  upgrade <domain> <email> [foldername]          - Upgrade from self-signed to Let's Encrypt"
        echo "  renew                                          - Renew all certificates"
        echo "  renew-test                                     - Test renewal (dry-run)"
        echo "  list                                           - List all certificates"
        echo "  revoke <domain>                                - Revoke a certificate"
        echo "  delete <domain>                                 - Delete a certificate"
        echo "  info <domain>                                  - Show certificate info"
        echo ""
        echo "Examples:"
        echo "  manage_certbot.sh obtain example.com admin@example.com /var/www/html nginx"
        echo "  manage_certbot.sh upgrade example.com admin@example.com example"
        echo "  manage_certbot.sh renew"
        echo "  manage_certbot.sh list"
        echo "  manage_certbot.sh revoke example.com"
        exit 1
        ;;
esac

